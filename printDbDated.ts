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

async function printer() {
    var docs = (await db.allDocs({ include_docs: true, attachments: true })).rows.map(o => o.doc);
    var att = flatten(docs.map(expandAtachments).map(o => vals(o._attachments)));
    att.sort((a, b) => (new Date(a.createdAt) as any) - (new Date(b.createdAt) as any))
    console.log(att);
}
printer();

function flatten(v) {
    return v.reduce((prev, next) => prev.concat(next), []);
}