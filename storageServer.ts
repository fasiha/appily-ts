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

function createFactUpdateKey(user: string, docId: string, factId: string, createdAt: Date): string {
    return `${user}::${docId}::${factId}::${createdAt.toISOString()}`;
}

export async function submit(db: Db, user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject = {}) {
    let createdAt = new Date();
    let key = createFactUpdateKey(user, docId, factId, createdAt);
    let u: FactUpdate = { user, docId, factId, createdAt, ebisuObject, updateObject };
    try {
        await (db as any).putAsync(key, JSON.stringify(u));
    } catch (e) {
        console.error("Error", e);
    }
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

export function leveldbToStream(db: Db, opts?: any): xs<KeyVal> {
    return levelStreamToXstream(db.createReadStream(opts)) as xs<KeyVal>;
}

export function makeLeveldbOpts(user: string, docId: string = '', factId: string = '', factIdFragment: boolean = true) {
    let ret = (a: string, b: string) => ({ gte: a, lt: b });
    let a: string = `${user}`;
    let b: string = `${user}`;
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
            b += '\uffff';
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

import dropRepeats from 'xstream/extra/dropRepeats'

export function omitNonlatestUpdates(db: Db, opts: any = {}): xs<FactUpdate> {
    opts.reverse = true;

    // a, b are KeyVal but xstream gets confused with these types
    const eq = (a, b) => a.key.split('::')[2] === b.key.split('::')[2];
    return leveldbToStream(db, opts).compose(dropRepeats(eq))
        .map((x: KeyVal) => JSON.parse(x.value) as FactUpdate);
}

export function getMostForgottenFact(db: Db, opts: any = {}): xs<[FactUpdate, number]> {
    const dnow = new Date();
    const elapsedHours = (d: Date) => ((dnow as any) - (d as any)) / 3600e3 as number;
    const factUpdateToProb = (f: FactUpdate) => {
        // JSON converts Infinity to `null` :-/
        if (f.ebisuObject[2] && isFinite(f.ebisuObject[2])) {
            return ebisu.predictRecall(f.ebisuObject, elapsedHours(new Date(f.createdAt)));
        }
        return 1;
    };
    let orig = omitNonlatestUpdates(db, opts);
    return orig.fold(([prev, probPrev]: [FactUpdate, number], next) => {
        if (!prev) {
            let prob = factUpdateToProb(next);
            return [next, prob];
        }
        let probNext = factUpdateToProb(next);
        if (probNext < probPrev) { return [next, probNext]; }
        return [prev, probPrev];
    }, [null, null])
        .last() as xs<[FactUpdate, number]>;
}

export function getKnownFactIds(db: Db, opts: any = {}) {
    let keys = leveldbToKeyStream(db, opts);
    return keys.map(s => s.split('::')[2]).compose(dropRepeats());
}


const multilevel = require('multilevel');
export function makeShoeInit(db: Db) {
    return (function(stream) { stream.pipe(multilevel.server(db)).pipe(stream); });
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
