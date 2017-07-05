import { EbisuObject } from "./ebisu";
import levelup = require("levelup");
import bluebird = require('bluebird');

var db = levelup('./mydb');
bluebird.promisifyAll(db);
// see https://github.com/petkaantonov/bluebird/issues/304#issuecomment-274362312

export interface FactUpdate {
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
function leveldbToStream(opts?: any): Kefir.Stream<KeyVal, any> {
    var levelStream = db.createReadStream(opts);
    // Can't use `Kefir.fromEvents` because that doesn't understand
    // `close`/`end` events, so the resulting Kefir stream never ends.
    // This is bad because I need `last` to work.
    return Kefir.stream(emitter => {
        levelStream.on("data", data => emitter.emit(data));
        levelStream.on("close", () => emitter.end());
    });
}

export function omitNonlatestUpdates(user: string, docId?: string): Kefir.Stream<FactUpdate, any> {
    let opts: any = { reverse: true };
    if (docId) {
        opts.gte = `${user}::${docId}::`;
        opts.lt = `${user}::${docId};`;
    } else {
        opts.gte = `${user}::`;
        opts.lt = `${user};`;
    }
    return leveldbToStream(opts)
        .skipDuplicates((a: KeyVal, b: KeyVal) => a.key.split('::')[2] === b.key.split('::')[2])
        .map((x: KeyVal) => JSON.parse(x.value) as FactUpdate);
}

import { ebisu } from "./ebisu";
export function mostForgottenFact(user: string, docId?: string): Kefir.Stream<FactUpdate, any> {
    const dnow = new Date();
    const elapsedHours = (d: Date) => ((dnow as any) - (d as any)) / 3600e3 as number;
    const factUpdateToProb = (f: FactUpdate) => ebisu.predictRecall(f.ebisuObject, elapsedHours(new Date(f.createdAt)));
    let orig = omitNonlatestUpdates(user, docId);
    let scanned = orig.scan(([prev, probPrev]: any, next: FactUpdate): any => {
        if (!prev) {
            let prob = factUpdateToProb(next);
            return [next, prob];
        }
        let probNext = factUpdateToProb(next);
        if (probNext < probPrev) { return [next, probNext]; }
        return [prev, probPrev];
    }, [null, null] as any);
    return scanned.last().map(x => x[0] as FactUpdate);
}
// var f = mostForgottenFact("ammy"); f.log();

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
    leveldbToStream().log("printDb");
}

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
