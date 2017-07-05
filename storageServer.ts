import { EbisuObject } from "./ebisu";
import levelup = require("levelup");
import bluebird = require('bluebird');

var db = levelup('./mydb');
bluebird.promisifyAll(db);
// see https://github.com/petkaantonov/bluebird/issues/304#issuecomment-274362312

interface FactUpdate {
    user: string;
    docId: string;
    factId: string;
    createdAt: Date;
    ebisuObject: any;
    updateObject?: any;
}

interface KeyVal { key: string, value: string };

function createFactUpdateKey(user: string, docId: string, factId: string, createdAt: Date): string {
    return `${user}::${docId}::${factId}::${createdAt.toISOString()}`;
}

export async function submit(user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject = {}) {
    let createdAt = new Date();
    let key = createFactUpdateKey(user, docId, factId, createdAt);
    let u: FactUpdate = { user, docId, factId, createdAt, ebisuObject, updateObject };
    try {
        await (db as any).putAsync(key, JSON.stringify(u));
    } catch (e) {
        console.error("Error", e);
    }
}

import Kefir = require("kefir");
export function omitNonlatestUpdates(user: string, docId?: string) {
    let opts: any = { reverse: true };
    if (docId) {
        opts.gte = `${user}::${docId}::`;
        opts.lt = `${user}::${docId};`;
    } else {
        opts.gte = `${user}::`;
        opts.lt = `${user};`;
    }
    var levelStream = db.createReadStream(opts);
    var kefirStream = Kefir.stream(emitter => {
        levelStream.on("data", data => emitter.emit(data));
        levelStream.on("close", () => emitter.end());
    });
    return kefirStream
        .skipDuplicates((a: KeyVal, b: KeyVal) => a.key.split('::')[2] === b.key.split('::')[2])
        .map((x: KeyVal) => JSON.parse(x.value) as FactUpdate);
}

import { ebisu } from "./ebisu";
export function mostForgottenFact(user: string, docId?: string) {
    var dnow = new Date();
    var elapsedHours = (d: Date) => ((dnow as any) - (d as any)) / 3600e3 as number;
    var orig = omitNonlatestUpdates(user, docId);
    var formatted = orig.diff((prev, next): any => {
        var pnext = ebisu.predictRecall(next.ebisuObject, elapsedHours(new Date(next.createdAt)));
        var pprev = ebisu.predictRecall(prev.ebisuObject, elapsedHours(new Date(prev.createdAt)));
        return pnext < pprev ? next : prev;
    });
    return formatted.last();
}
// var f = mostForgottenFact("ammy");

export function knownFactIds(user: string, docId: string): Promise<any> {
    let prefix = `${user}::${docId}::`;
    return new Promise((resolve, reject) => {
        let returnSet = new Set<string>();
        db.createReadStream({ gte: `${user}::${docId}::`, lt: `${user}::${docId};`, reverse: true })
            .on('data', function(data: KeyVal) {
                const subkey = data.key.slice(prefix.length);
                const factId = subkey.slice(0, subkey.indexOf('::'));
                returnSet.add(factId);
            })
            .on('error', function(err) {
                reject(new Error(err));
            })
            .on('end', function() {
                resolve(returnSet);
            });
    });
}

export function printDb(): void {
    db.createReadStream()
        .on('data', data => console.log("STREAM", data.key, '=', data.value))
        .on('error', err => console.log('STREAM ERR', err))
        .on('close', () => console.log('STREAM CLOSED'))
        .on('end', () => console.log('STREAM END.'));
}


// submit("ammy", "toponym", "平等院-kanji", { a: 4, b: 4, t: 0.25 });

// import express = require('express');
// import bodyParser = require('body-parser');
// var app = express();
// app.use(bodyParser.json());
// app.get('/', (req, res) => {
//     res.send('Yoyo!')
// });
// app.post('/submit', (req, res) => {
//     console.log("Submitted:", req.body);
//     res.setHeader('Content-Type', 'text/plain');
//     res.end("OK");
//     let b = req.body;
//     submit(b[0], b[1], b[2], b[3]);
// })
// const port = 3001;
// app.listen(port, () => { console.log(`Started: http://127.0.0.1:${port}`) });
