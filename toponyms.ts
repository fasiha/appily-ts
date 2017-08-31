const shuffle = require('lodash.shuffle');
const sampleSize = require('lodash.sampleSize');


import { FactUpdate, FactDb } from "./storageServer";
import { ebisu, EbisuObject } from "./ebisu";
import { furiganaStringToReading, parseMarkdownLinkRuby, furiganaStringToPlain, Furigana, Ruby } from "./ruby";
import { elapsedHours, all, concatMap } from "./utils";

export const toponyms: FactDb = { setup, whatToLearn, howToQuiz, stripFactIdOfSubfact, factToFactIds };

export const WEB_URL = "https://fasiha.github.io/toponyms-and-nymes/";
const RUBY_START = '- Ruby: ';


export type Fact = Furigana[];
export interface ToponymsData {
    allFacts: Fact[];
    availableFactIds: Set<string>;
}

async function setup(inputs: string[]): Promise<ToponymsData> {
    const allFacts = concatMap(inputs,
        text => text
            .trim()
            .split('\n')
            .filter(s => s.indexOf(RUBY_START) === 0)
            .map(s => s.slice(RUBY_START.length))
            .map(parseMarkdownLinkRuby))
    const availableFactIds = new Set(concatMap(allFacts, factToFactIds));
    return { allFacts, availableFactIds }
}

function stripFactIdOfSubfact(factId: string): string {
    return factId.split('-').slice(0, -1).join('');
}

function factToFactIds(word: Fact) {
    let plain = furiganaStringToPlain(word);
    return [`${plain}-kanji`, `${plain}-reading`];
}

function whatToLearn(data: ToponymsData, knownFactIds: string[]): Fact {
    const knownIdsSet = new Set(knownFactIds.filter(s => data.availableFactIds.has(s)));
    return data.allFacts.find(fact => !all(factToFactIds(fact).map(s => knownIdsSet.has(s))));
}

export interface HowToQuizInfo {
    fact: Fact;
    confusers?: Fact[];
};
function howToQuiz(data: ToponymsData, factId: string): HowToQuizInfo {
    // let allFacts: Array<Furigana[]> = await allFactsProm;
    let plain0 = stripFactIdOfSubfact(factId);
    let fact = data.allFacts.find(fact => furiganaStringToPlain(fact) === plain0);
    let ret: HowToQuizInfo = { fact };

    if (factId.indexOf('-kanji') >= 0) {
        ret.confusers = shuffle(sampleSize(data.allFacts, 4).concat([fact])); // suffle after appending correct answer
    }
    return ret;
}
