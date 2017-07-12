import { shuffle, sampleSize } from "lodash";

import { FactUpdate, FactDb } from "./storageServer";
import { ebisu, EbisuObject } from "./ebisu";
import { uncachedUrlFetch, dedupeViaSets, endsWith, elapsedHours, all, any, concatMap } from "./utils";
import { furiganaStringToPlain, parseJmdictFurigana } from "./ruby";

export const tono5k: FactDb = { stripFactIdOfSubfact, whatToLearn, howToQuiz };

const TONO_URL = "https://raw.githubusercontent.com/fasiha/tono-yamazaki-maekawa/master/tono.json";
const TONO_LOCAL = 'tono.json';

const allFactsProm: Promise<Tono[]> = urlToFacts(TONO_URL, TONO_LOCAL);
const availableFactIdsProm: Promise<Set<string>> = allFactsProm.then(allFacts => new Set(concatMap(allFacts, factToFactIds)));
const allFactsWithKanjiProm = allFactsProm.then(allFacts => allFacts.filter((fact: Tono) => fact.kanjis.length > 0));

export function stripFactIdOfSubfact(factId: string): string {
    return factId.split('-').slice(0, -1).join('');
}

export interface Tono {
    readings: string[];
    meaning: string;
    kanjis: string[];
    roumaji: string;
    num: number;
    freq: number;
    disp: number;
    register?: string;
}

async function urlToFacts(url: string, local: string): Promise<Tono[]> {
    let json: Tono[] = JSON.parse(await uncachedUrlFetch(url));
    return json.map(tono => {
        tono.kanjis = dedupeViaSets(tono.kanjis.map(k => furiganaStringToPlain(parseJmdictFurigana(k))));
        return tono;
    })
}

export function factToFactIds(fact: Tono): string[] {
    const plain = fact.num;
    if (fact.kanjis.length > 0) {
        return 'kanji,reading,meaning'.split(',').map(sub => `${plain}-${sub}`);
    }
    return 'reading,meaning'.split(',').map(sub => `${plain}-${sub}`);
}

export async function whatToLearn(USER: string, DOCID: string, knownFactIds: string[]): Promise<Tono> {
    const allFacts = await allFactsProm;
    const availableFactIds = new Set(concatMap(allFacts, factToFactIds));
    const knownIdsSet = new Set(knownFactIds.filter(s => availableFactIds.has(s)));

    // Only look for the following parts of speech:
    const lookFors = 'n.,v.,adj.,adv.,pron.,adn.'.split(',');
    let fact: Tono = allFacts.find(fact => lookFors.findIndex(pos => fact.meaning.includes(pos)) >= 0
        && !all(factToFactIds(fact).map(s => knownIdsSet.has(s))));
    return fact;
};

export interface HowToQuizInfo {
    fact: Tono;
    confusers?: Tono[];
};

export async function howToQuiz(USER: string, DOCID: string, factId: string, allUpdates: FactUpdate[]): Promise<HowToQuizInfo> {
    let allFacts: Tono[] = await allFactsProm;
    let plain0 = +stripFactIdOfSubfact(factId);
    let fact = allFacts.find(fact => fact.num === plain0);

    let ret: HowToQuizInfo = { fact };
    if (endsWith(factId, '-kanji') || endsWith(factId, '-meaning')) {
        const kanjiQuiz = endsWith(factId, '-kanji');
        const confusers = shuffle(sampleSize(kanjiQuiz ? await allFactsWithKanjiProm : allFacts, 4).concat([fact]));
        ret.confusers = confusers;
    }
    return ret;
}
