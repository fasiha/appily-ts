import { EbisuObject } from "./ebisu";
import levelup = require("levelup");

export interface FactUpdate {
    user: string;
    docId: string;
    factId: string;
    createdAt: Date;
    ebisuObject: EbisuObject;
    updateObject?: any;
}

type Db = levelup.LevelUpBase<levelup.Batch>;
type SubmitFunction = (user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) => Promise<void>;
type PromptFunction = () => Promise<string>;
export interface FactDb {
    setup: (submit: SubmitFunction, prompt: PromptFunction) => void;
    administerQuiz: (USER: string, DOCID: string, factId: string, allUpdates: FactUpdate[]) => Promise<void>;
    findAndLearn: (USER: string, DOCID: string, knownFactIds: string[]) => Promise<void>;
    stripFactIdOfSubfact: (factId: string) => string;
}

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

import Kefir = require("kefir");

export function leveldbToStream(db: Db, opts?: any): Kefir.Stream<KeyVal, any> {
    var levelStream = db.createReadStream(opts);
    // Can't use `Kefir.fromEvents` because that doesn't understand
    // `close`/`end` events, so the resulting Kefir stream never ends.
    // This is bad because I need `last` to work.
    return Kefir.stream(emitter => {
        levelStream.on("data", data => emitter.emit(data));
        levelStream.on("close", () => emitter.end());
    });
}

function leveldbToKeyStream(db: Db, opts?: any): Kefir.Stream<string, any> {
    var levelStream = db.createKeyStream(opts);
    return Kefir.stream(emitter => {
        levelStream.on("data", data => emitter.emit(data));
        levelStream.on("close", () => emitter.end());
    });
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

export function omitNonlatestUpdates(db: Db, opts: any = {}): Kefir.Stream<FactUpdate, any> {
    opts.reverse = true;

    return leveldbToStream(db, opts)
        .skipDuplicates((a: KeyVal, b: KeyVal) => a.key.split('::')[2] === b.key.split('::')[2])
        .map((x: KeyVal) => JSON.parse(x.value) as FactUpdate);
}

export function collectKefirStream<T>(s: Kefir.Stream<T, any>): Promise<T[]> {
    let ret: T[] = [];
    return s
        .scan((prev, next) => (prev as any).concat(next), ret as any)
        .last()
        .toPromise();
}

import { ebisu } from "./ebisu";
export function getMostForgottenFact(db: Db, opts: any = {}): Kefir.Stream<[FactUpdate, number], any> {
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
    // @types/kefir spec for `scan` is too narrow, so I need a lot of `any`s here 😢
    let scanned: Kefir.Stream<[FactUpdate, number], any> = orig.scan(([prev, probPrev]: any, next: FactUpdate): any => {
        if (!prev) {
            let prob = factUpdateToProb(next);
            return [next, prob];
        }
        let probNext = factUpdateToProb(next);
        if (probNext < probPrev) { return [next, probNext]; }
        return [prev, probPrev];
    }, [null, null] as any) as any;
    return scanned
        .last();
}
// var f = mostForgottenFact("ammy"); f.log();

export function getKnownFactIds(db: Db, opts: any = {}) {
    let keys = leveldbToKeyStream(db, opts);
    return keys.map(s => s.split('::')[2]).skipDuplicates();
}

export function printDb(db: Db): void {
    // Kefir's `log` might produce paragraphs, which is hard to grep, so manual print:
    leveldbToStream(db).observe({
        value(value) {
            console.log('printDb:' + JSON.stringify(value));
        },
    });
}

const multilevel = require('multilevel');
export function makeShoeInit(db: Db) {
    return (function(stream) { stream.pipe(multilevel.server(db)).pipe(stream); });
} 
