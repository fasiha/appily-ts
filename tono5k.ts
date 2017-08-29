const shuffle = require('lodash.shuffle');
const sampleSize = require('lodash.sampleSize');

import { FactUpdate, FactDb } from "./storageServer";
import { ebisu, EbisuObject } from "./ebisu";
import { dedupeViaSets, endsWith, elapsedHours, all, any, concatMap } from "./utils";
import { furiganaStringToPlain, parseJmdictFurigana } from "./ruby";

export const tono5k: FactDb = { setup, stripFactIdOfSubfact, whatToLearn, howToQuiz, factToFactIds };

export interface TonoData {
    allFacts: Tono[];
    allFactsWithKanji: Tono[];
    availableFactIds: Set<string>;
}

async function setup(input: string): Promise<TonoData> {
    let parsed: Tono[] = JSON.parse(input);
    const allFacts = parsed.map(tono => {
        tono.kanjis = dedupeViaSets(tono.kanjis.map(k => furiganaStringToPlain(parseJmdictFurigana(k))));
        return tono;
    });
    const allFactsWithKanji = allFacts.filter((fact: Tono) => fact.kanjis.length > 0);
    const availableFactIds = new Set(concatMap(allFacts, factToFactIds));
    return { availableFactIds, allFacts, allFactsWithKanji };
}

function stripFactIdOfSubfact(factId: string): string {
    return factId.split('-').slice(0, -1).join('');
}

export interface Tono {
    readings: string[];
    meaning: string;
    kanjis: string[];
    num: number;
    // roumaji: string;
    // freq: number;
    // disp: number;
    // register?: string;
}

function factToFactIds(fact: Tono): string[] {
    const plain = fact.num;
    if (fact.kanjis.length > 0) {
        return 'kanji,reading,meaning'.split(',').map(sub => `${plain}-${sub}`);
    }
    return 'reading,meaning'.split(',').map(sub => `${plain}-${sub}`);
}

function whatToLearn(data: TonoData, knownFactIds: string[]): Tono {
    const knownIdsSet = new Set(knownFactIds.filter(s => data.availableFactIds.has(s)));

    // Only look for the following parts of speech:
    const lookFors = 'n.,v.,adj.,adv.,pron.,adn.'.split(',');
    let fact: Tono = data.allFacts.find(fact => lookFors.findIndex(pos => fact.meaning.includes(pos)) >= 0
        && !all(factToFactIds(fact).map(s => knownIdsSet.has(s))));
    return fact;
};

export interface HowToQuizInfo {
    fact: Tono;
    confusers?: Tono[];
};

function howToQuiz(data: TonoData, factId: string): HowToQuizInfo {
    let allFacts: Tono[] = data.allFacts;
    const allFactsWithKanji = data.allFactsWithKanji;
    let plain0 = +stripFactIdOfSubfact(factId);
    let fact = allFacts.find(fact => fact.num === plain0);
    if (!fact) {
        console.error("Couldn't find fact! FIXME FIXME!:", factId);
        return null;
    }

    let ret: HowToQuizInfo = { fact };
    if (endsWith(factId, '-kanji') || endsWith(factId, '-meaning')) {
        const kanjiQuiz = endsWith(factId, '-kanji');
        const confusers = shuffle(sampleSize(kanjiQuiz ? allFactsWithKanji : allFacts, 4).concat([fact]));
        ret.confusers = confusers;
    }
    return ret;
}
