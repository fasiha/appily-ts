import levelup = require("levelup");
// import Kefir = require("kefir");
import xs from 'xstream';

import { ebisu, EbisuObject } from "./ebisu";
import { elapsedHours } from "./utils";

export interface FactUpdate {
    user: string;
    docId: string;
    factId: string;
    createdAt: Date;
    ebisuObject: EbisuObject;
    updateObject?: any;
}

type Db = levelup.LevelUpBase<levelup.Batch>;
interface KeyVal { key: string, value: string };

function createFactUpdateKeys(user: string, docId: string, factId: string, createdAt: Date): [string, string] {
    const historic = `hi::${user}::${docId}::${factId}::${createdAt.toISOString()}`;
    const current = `cu::${user}::${docId}::${factId}::`;
    return [historic, current];
}

export async function submit(db: Db, user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject = {}) {
    let createdAt = new Date();
    let keys = createFactUpdateKeys(user, docId, factId, createdAt);
    let u: FactUpdate = { user, docId, factId, createdAt, ebisuObject, updateObject };
    const ustr: string = JSON.stringify(u);
    Promise.all(keys.map(key => (db as any).putAsync(key, ustr)))
        .catch(e => console.error('Submit error', e));
}

function levelStreamToXstream(levelStream) {
    return xs.create({
        start: listener => {
            levelStream.on('data', data => listener.next(data));
            levelStream.on('close', () => listener.complete());
        },
        stop: () => { }
    });
}

export function leveldbToKeyStream(db: Db, opts?: any): xs<string> {
    return levelStreamToXstream(db.createKeyStream(opts)) as xs<string>;
}

export function leveldbToValueStream(db: Db, opts?: any): xs<string> {
    return levelStreamToXstream(db.createValueStream(opts)) as xs<string>;
}

export function leveldbToStream(db: Db, opts?: any): xs<KeyVal> {
    return levelStreamToXstream(db.createReadStream(opts)) as xs<KeyVal>;
}

export function makeLeveldbOpts(user: string, docId: string = '', factId: string = '', factIdFragment: boolean = true) {
    let ret = (a: string, b: string) => ({ gte: a, lt: b });
    let a: string = `cu::${user}`;
    let b: string = `cu::${user}`;
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

export function getCurrentUpdates(db: Db, opts: any = {}): xs<FactUpdate> {
    return leveldbToValueStream(db, opts)
        .map(v => JSON.parse(v) as FactUpdate);
}

function factUpdateToProb(f: FactUpdate, dnow: Date): number {
    // JSON converts Infinity to `null` :-/
    if (f.ebisuObject[2] && isFinite(f.ebisuObject[2])) {
        return ebisu.predictRecall(f.ebisuObject, elapsedHours(new Date(f.createdAt), dnow));
    }
    return 1;
};

export function getMostForgottenFact(db: Db, opts: any = {}): xs<[FactUpdate, number]> {
    const dnow = new Date();
    return getCurrentUpdates(db, opts)
        .map(f => [f, factUpdateToProb(f, dnow)])
        .fold(([f0, p0]: [FactUpdate, number], [f1, p1]: [FactUpdate, number]) => p1 < p0 ? [f1, p1] : [f0, p0], [null, 1])
        .last() as xs<[FactUpdate, number]>;
}

export function getKnownFactIds(db: Db, opts: any = {}) {
    let keys = leveldbToKeyStream(db, opts);
    return keys.map(s => s.split('::')[3]);
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
