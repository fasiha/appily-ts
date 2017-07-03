import levelup = require("levelup");
import bluebird = require('bluebird');

var db = levelup('./mydb');
bluebird.promisifyAll(db);
// see https://github.com/petkaantonov/bluebird/issues/304#issuecomment-274362312

// 2) put a key & value 
db.put({ name: "Ammy", age: 191 }, ['LevelPOOP!', { cray: true }, 1234], function(err) {
    if (err) return console.log('Ooops!', err) // some kind of I/O error
});
db.put("name", 'LevelPOOP!', function(err) {
    if (err) return console.log('Ooops!', err) // some kind of I/O error
});


// (db as any).getAsync('name').then(x=>console.log("GOT", x));
async function read() {
    var foo = await (db as any).getAsync('name');
    console.log("AWAITED", foo);
    return foo;
}

read().then(x => console.log("outside boo", x));


type EbisuObject = Array<number>;

interface FactUpdate {
    user: string;
    docId: string;
    factId: string;
    createdAt: Date;
    ebisuObject: any;
    updateObject?: any;
}

function createFactUpdateKey(user: string, docId: string, factId: string, createdAt: Date): string {
    return `${user}::${docId}::${factId}::${createdAt.toISOString()}`;
}

async function submit(user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject = {}) {
    let createdAt = new Date();
    let key = createFactUpdateKey(user, docId, factId, createdAt);
    let u: FactUpdate = { user, docId, factId, createdAt, ebisuObject, updateObject };
    try {
        await (db as any).putAsync(key, JSON.stringify(u));
    } catch (e) {
        console.error("Error", e);
    }
}

interface KeyVal { key: string, value: string };

async function omitNonlatestUpdates(user: string, docId: string): Promise<any> {
    let p = new Promise((resolve, reject) => {
        let s = new Set<FactUpdate>();
        let previousFactId: string = null;
        db.createReadStream({ gte: `${user}::${docId}::`, lt: `${user}::${docId};`, reverse: true })
            .on('data', function(data: KeyVal) {
                console.log("STREAM", data.key, '=', data.value);
                const keyPieces: string[] = data.key.split("::");
                if (previousFactId && previousFactId === keyPieces[2]) {
                    return;
                } else {
                    s.add(JSON.parse(data.value));
                    previousFactId = keyPieces[2];
                }
            })
            .on('error', function(err) {
                console.log('Oh my!', err);
                reject(new Error(err));
            })
            .on('close', function() {
                console.log('Stream closed');
            })
            .on('end', function() {
                console.log('Stream ended. Promise will now be resolved.');
                resolve(s);
            });

    });
    return p;
}

function printDb(): void {
    db.createReadStream()
        .on('data', data => console.log("STREAM", data.key, '=', data.value))
        .on('error', err => console.log('STREAM ERR', err))
        .on('close', () => console.log('STREAM CLOSED'))
        .on('end', () => console.log('STREAM END.'));
}


// submit("ammy", "toponym", "平等院-kanji", { a: 4, b: 4, t: 0.25 });

import express = require('express');
import bodyParser = require('body-parser');
var app = express();
app.use(bodyParser.json());
app.get('/', (req, res) => {
    res.send('Yoyo!')
});
app.post('/submit', (req, res) => {
    console.log("Submitted:", req.body);
    res.setHeader('Content-Type', 'text/plain');
    res.end("OK");
    let b = req.body;
    submit(b[0], b[1], b[2], b[3]);
})

// const port = 3001;
// app.listen(port, () => { console.log(`Started: http://127.0.0.1:${port}`) });
