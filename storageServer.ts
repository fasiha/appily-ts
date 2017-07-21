import PouchDB = require('pouchdb');
import xs from 'xstream';

import { Db } from "./diskPouchDb";
import { ebisu, EbisuObject } from "./ebisu";
import { elapsedHours, utoa } from "./utils";

export interface FactUpdate {
    user: string;
    docId: string;
    factId: string;
    createdAt: string;
    ebisuObject: EbisuObject;
    updateObject?: any;
    _id?: string;
    _attachments?: any;
}

interface KeyVal { key: string, value: string };

const ID_PREFIX_FACT = 'v1::';

function createFactUpdateKey(user: string, docId: string, factId: string): string {
    return `${ID_PREFIX_FACT}${user}::${docId}::${factId}`;
}

function upsert(db, docId: string, diffFunc) {
    return db.upsert(docId, diffFunc);
}

export async function submit(db: Db, user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject = {}) {
    let createdAt: string = (new Date()).toISOString();
    let _id = createFactUpdateKey(user, docId, factId);
    let u: FactUpdate = { _id, user, docId, factId, createdAt, ebisuObject, updateObject };

    upsert(db, _id, old => {
        if (old._id) {
            // just update
            old.createdAt = createdAt;
            old.ebisuObject = ebisuObject;
            old.updateObject = updateObject;
        } else {
            // brand new. Copy to avoid messing up _attachment
            old = Object.assign({}, u);
        }
        if (!old._attachments) {
            old._attachments = {};
        }
        old._attachments[createdAt] = { content_type: 'text/plain', data: utoa(JSON.stringify(u)) };

        return old;
    });
}

export function makeLeveldbOpts(user: string, docId: string = '', factId: string = '', factIdFragment: boolean = true, include_docs: boolean = true) {
    let ret = (a: string, b: string) => ({ startkey: a, endkey: b, inclusive_end: false, include_docs });
    let a: string = `${ID_PREFIX_FACT}${user}`;
    let b: string = `${ID_PREFIX_FACT}${user}`;
    if (docId.length) {
        a += `::${docId}`;
        b += `::${docId}`;
    } else {
        a += '::';
        b += ';';
        return ret(a, b);
    }

    if (factId.length) {
        a += `::${factId}`;
        b += `::${factId}`;
        if (factIdFragment) {
            b += '\ufff0';
        } else {
            a += '::';
            b += ';';
        }
        return ret(a, b);
    } else {
        a += '::';
        b += ';';
    }
    return ret(a, b);
}

async function allDocsReduce(db: Db, opts, func, init, limit: number = 25, verbose: boolean = false) {
    opts = Object.assign({}, opts); // copy
    opts.limit = limit;
    while (1) {
        let res = await db.allDocs(opts);
        if (res.rows.length === 0) {
            return init;
        }
        init = res.rows.reduce(func, init);
        opts.startkey = res.rows[res.rows.length - 1].key;
        opts.skip = 1;
        if (verbose) { console.log('init', init); }
    }
}

const factUpdateToProb = (f: FactUpdate, dnow: Date) => {
    // JSON converts Infinity to `null` :-/
    if (f.ebisuObject[2] && isFinite(f.ebisuObject[2])) {
        return ebisu.predictRecall(f.ebisuObject, elapsedHours(new Date(f.createdAt), dnow));
    }
    return 1;
};

export async function getMostForgottenFact(db: Db, opts: any = {}): Promise<[FactUpdate, number]> {
    const dnow = new Date();
    const reducer = ([prev, probPrev]: [FactUpdate, number], next): [FactUpdate, number] => {
        const doc = next.doc as FactUpdate;
        if (!prev) {
            let prob = factUpdateToProb(next.doc as FactUpdate, dnow);
            return [doc, prob];
        }
        let probNext = factUpdateToProb(next.doc as FactUpdate, dnow);
        if (probNext < probPrev) { return [doc, probNext]; }
        return [prev, probPrev];
    };
    const init = [null, null];
    // return allDocsReduce(db, opts, reducer, init, 50, true)
    return (await db.allDocs(opts)).rows.reduce(reducer, init) as [FactUpdate, number];
}

export async function getKnownFactIds(db: Db, opts: any = {}) {
    opts = Object.assign({}, opts); // copy
    opts.include_docs = false;
    let keys = await db.allDocs(opts);
    return keys.rows.map(s => s.id.split('::')[3]);
}

export async function allDocs(db: Db, opts: any) {
    return (await db.allDocs(opts)).rows.map(x => x.doc);
}

//

interface DoneQuizzingInfo {
    result: boolean;
    wasActiveRecall?: boolean;
}
export async function doneQuizzing(db: Db, USER: string, DOCID: string, factId: string, allUpdates: FactUpdate[], info: DoneQuizzingInfo): Promise<void> {
    for (let u of allUpdates) {
        if (u.factId === factId) {
            // active update
            info.wasActiveRecall = true;
            let newEbisu = ebisu.updateRecall(u.ebisuObject, info.result, elapsedHours(new Date(u.createdAt)));
            await submit(db, USER, DOCID, factId, newEbisu, info);
        } else {
            // passive update: update the timestamp, keep the ebisu prior the same.
            info.wasActiveRecall = false;
            await submit(db, USER, DOCID, u.factId, u.ebisuObject, info);
        }
    }
}

export interface FactDb {
    whatToLearn: (knownFactIds: string[]) => Promise<any>;
    howToQuiz: (factId: string) => Promise<any>
    stripFactIdOfSubfact: (factId: string) => string;
    factToFactIds: (fact: any) => string[];
}
