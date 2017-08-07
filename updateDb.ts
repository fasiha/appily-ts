/* 
This converts a Appily level database printout (made via printDatedDb.ts), in
the old v1 format, of `${user}::${docid}::${factid}::${createdAt}` to the new
v2 format of `cu::${user}::${docid}::${factid}::` AND
`hi::${user}::${docid}::${factid}::${createdAt}`, where the former is
`hi`storic and the latter is `cu`rrent (or the latest) updates.
*/

import { readFileSync } from 'fs';

var rows = readFileSync('mydb.txt', 'utf8').trim().split('\n').map(s => s.split('→'));

var mAll: Map<string, string[]> = new Map([]);
var mLatest: Map<string, string> = new Map([]);

rows.forEach(([key, val]: [string, string]) => {
    const thiskey = key.split('::').slice(0, -1).join('::') + '::';
    mAll.set(thiskey, mAll.has(thiskey) ? mAll.get(thiskey).concat(val) : [val]);
});

for (const [key, vals] of Array.from(mAll.entries())) {
    mLatest.set(key, vals[vals.length - 1]);
}

import levelup = require("levelup");
export const db: levelup.LevelUpBase<levelup.Batch> = levelup('./mydbv2');

function fix(s: string) {
    return s.replace('ammy', 'Zok4J4riZWgWNhKQ');
}

Array.from(mLatest.entries()).forEach(([k, v]) => db.put('cu::' + fix(k), fix(v)));

for (const [k, vs] of Array.from(mAll.entries())) {
    for (const v of vs) {
        const o = JSON.parse(v);
        db.put('hi::' + fix(k) + o.createdAt, fix(v));
    }
}
// Make sure all data was committed! Node might conceivably exit before level finishes?