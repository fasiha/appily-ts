import { db } from "./diskPouchDb";
import { xstreamToPromise, atou } from "./utils";
const atob = require('atob');

function expandAtachments(doc) {
    if (doc._attachments) {
        for (let k of Object.keys(doc._attachments)) {
            doc._attachments[k] = JSON.parse(atou(doc._attachments[k].data));
        }
    }
    return doc;
}

function vals(o) {
    return Object.keys(o).map(k => o[k])
}

async function printer(summary: boolean = true) {
    var docs = (await db.allDocs({ include_docs: true, attachments: true, conflicts: true })).rows.map(o => o.doc);
    if (!summary) {
        console.log(JSON.stringify(docs, null, 1));
        return;
    }
    var att = flatten(docs.map(expandAtachments).map(o => vals(o._attachments)));
    att.sort((a, b) => (new Date(a.createdAt) as any) - (new Date(b.createdAt) as any))
    console.log(att.map(o => JSON.stringify(o)).join('\n'));
}
printer();
// printer(false);


function flatten(v) {
    return v.reduce((prev, next) => prev.concat(next), []);
}