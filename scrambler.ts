const shuffle = require('lodash.shuffle');

import { FactUpdate, FactDb } from "./storageServer";
import { ebisu, EbisuObject } from "./ebisu";
import { uncachedUrlFetch, dedupeViaSets, endsWith, elapsedHours, all, any, concatMap } from "./utils";
import { furiganaStringToPlain, parseJmdictFurigana } from "./ruby";

export const scrambler: FactDb = { stripFactIdOfSubfact, whatToLearn, howToQuiz, factToFactIds };

const RAW_URL = "https://gist.githubusercontent.com/fasiha/5a4b806e986f6065e5827e6dd082343e/raw/bc2d1c165cb3d40db2925d052adad7d313d913ed/Dictionary_of_Basic_Japanese_Grammar_sentences.tsv";

const allFactsProm: Promise<Fact[]> = urlToFacts(RAW_URL);
const availableFactIdsProm: Promise<Set<string>> = allFactsProm.then(allFacts => new Set(concatMap(allFacts, factToFactIds)));

function stripFactIdOfSubfact(factId: string): string {
    return factId;
}

export interface Fact {
    text: string;
    translation: string;
}

async function urlToFacts(url: string): Promise<Fact[]> {
    const lines = (await uncachedUrlFetch(url)).trim().split('\n');
    return lines.map(s => {
        const [text, translation] = s.split('\t');
        return { text, translation };
    });
}

function factToFactIds(fact: Fact): string[] {
    return [fact.text];
}

async function whatToLearn(knownFactIds: string[]): Promise<Fact> {
    const allFacts = await allFactsProm;
    const availableFactIds = await availableFactIdsProm;
    const knownIdsSet = new Set(knownFactIds.filter(s => availableFactIds.has(s)));

    // Only look for the following parts of speech:
    let fact: Fact = allFacts.find(fact => !all(factToFactIds(fact).map(s => knownIdsSet.has(s))));
    return fact;
};

export interface HowToQuizInfo {
    fact: Fact;
    scrambled: string[];
};

async function howToQuiz(factId: string): Promise<HowToQuizInfo> {
    let allFacts: Fact[] = await allFactsProm;
    let plain0 = stripFactIdOfSubfact(factId);
    let fact = allFacts.find(fact => fact.text === plain0);
    let scrambled = shuffle(fact.text.split(''));
    return { fact, scrambled };
}
