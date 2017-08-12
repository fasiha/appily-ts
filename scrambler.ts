import { shuffle } from "lodash";

import { FactUpdate, FactDb } from "./storageServer";
import { ebisu, EbisuObject } from "./ebisu";
import { uncachedUrlFetch, dedupeViaSets, endsWith, elapsedHours, all, any, concatMap } from "./utils";
import { furiganaStringToPlain, parseJmdictFurigana } from "./ruby";

export const scrambler: FactDb = { setup, stripFactIdOfSubfact, whatToLearn, howToQuiz, factToFactIds };

// const RAW_URL = "https://gist.githubusercontent.com/fasiha/5a4b806e986f6065e5827e6dd082343e/raw/bc2d1c165cb3d40db2925d052adad7d313d913ed/Dictionary_of_Basic_Japanese_Grammar_sentences.tsv";

export interface ScramblerData {
    allFacts: Fact[];
    availableFactIds: Set<string>;
}

async function setup(inputs: string[]): Promise<ScramblerData> {
    const allFacts = concatMap(inputs, input => input.trim().split('\n').map(s => {
        const [text, translation] = s.split('\t');
        return { text, translation };
    }));
    const availableFactIds = new Set(concatMap(allFacts, factToFactIds));
    return { allFacts, availableFactIds };
}

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

async function whatToLearn(data: ScramblerData, knownFactIds: string[]): Promise<Fact> {
    const knownIdsSet = new Set(knownFactIds.filter(s => data.availableFactIds.has(s)));

    // Only look for the following parts of speech:
    let fact: Fact = data.allFacts.find(fact => !all(factToFactIds(fact).map(s => knownIdsSet.has(s))));
    return fact;
};

export interface HowToQuizInfo {
    fact: Fact;
    scrambled: string[];
};

function howToQuiz(data: ScramblerData, factId: string): HowToQuizInfo {
    let plain0 = stripFactIdOfSubfact(factId);
    let fact = data.allFacts.find(fact => fact.text === plain0);
    let scrambled = shuffle(fact.text.split(''));
    return { fact, scrambled };
}
