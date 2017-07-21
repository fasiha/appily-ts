var fs = require('fs');
var lines = fs.readFileSync("mydb.txt", "utf8").trim().split('\n');
var kv = lines.map(s => s.split('→')).map(([key, json]) => [key, JSON.parse(json)])

import { submit } from "./storageServer";
import { db, Db } from "./diskPouchDb";
async function port(kvs) {
    for (let kv of kvs) {
        let [key, val] = kv;
        await submit(db, val.user, val.docId, val.factId, val.ebisuObject, val.updateObject, val.createdAt);
    }
}
port(kv);