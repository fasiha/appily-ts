import levelup = require("levelup");
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
const assert = require('assert');

assert(process.argv.length >= 3 && process.argv[2].length > 0);
const datafile = process.argv[2];

const db = levelup('temp-' + randomBytes(4).toString('hex'));
import bluebird = require('bluebird');
bluebird.promisifyAll(db);

const data = readFileSync(datafile, 'utf8').trim().split('\n').map(line => line.split('→'));
function dump(data, db) {
    return Promise.all(data.map(([k, v]) => (db as any).putAsync(k, v)))
}

dump(data, db).then(_ => {
    db.createReadStream().on('data', ({ key, value }) => console.log(`${key}→${value}`))
})
