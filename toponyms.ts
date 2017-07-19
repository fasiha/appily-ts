import { shuffle, sampleSize } from "lodash";

import { FactUpdate, FactDb } from "./storageServer";
import { ebisu, EbisuObject } from "./ebisu";
import { furiganaStringToReading, parseMarkdownLinkRuby, furiganaStringToPlain, Furigana, Ruby } from "./ruby";
import { uncachedUrlFetch, elapsedHours, all, concatMap } from "./utils";

export const toponyms: FactDb = { whatToLearn, howToQuiz, stripFactIdOfSubfact , factToFactIds};


 function stripFactIdOfSubfact(factId: string): string {
    return factId.split('-').slice(0, -1).join('');
}

const TOPONYMS_URL = "https://raw.githubusercontent.com/fasiha/toponyms-and-nymes/gh-pages/README.md";
const TOPONYMS_LOCAL = "toponyms.md";
export const WEB_URL = "https://fasiha.github.io/toponyms-and-nymes/";

async function urlToFuriganas(url: string, local: string): Promise<Array<Furigana[]>> {
    const RUBY_START = '- Ruby: ';
    var text: string = await uncachedUrlFetch(url);
    var rubyLines: string[] = text.split('\n').filter(s => s.indexOf(RUBY_START) === 0).map(s => s.slice(RUBY_START.length));
    var furiganas = rubyLines.map(parseMarkdownLinkRuby);
    return furiganas;
}

export type Fact = Furigana[];

 function factToFactIds(word: Fact) {
    let plain = furiganaStringToPlain(word);
    return [`${plain}-kanji`, `${plain}-reading`];
}

 async function whatToLearn(knownFactIds: string[]): Promise<Fact> {
    const allFacts = await allFactsProm;
    const availableFactIds = new Set(concatMap(allFacts, factToFactIds));
    const knownIdsSet = new Set(knownFactIds.filter(s => availableFactIds.has(s)));
    return allFacts.find(fact => !all(factToFactIds(fact).map(s => knownIdsSet.has(s))));
}

export interface HowToQuizInfo {
    fact: Fact;
    confusers?: Fact[];
};
 async function howToQuiz(factId: string): Promise<HowToQuizInfo> {
    let allFacts: Array<Furigana[]> = await allFactsProm;
    let plain0 = stripFactIdOfSubfact(factId);
    let fact = allFacts.find(fact => furiganaStringToPlain(fact) === plain0);
    let ret: HowToQuizInfo = { fact };

    if (factId.indexOf('-kanji') >= 0) {
        ret.confusers = shuffle(sampleSize(allFacts, 4).concat([fact])); // suffle after appending correct answer
    }
    return ret;
}

const allFactsProm: Promise<Array<Furigana[]>> = urlToFuriganas(TOPONYMS_URL, TOPONYMS_LOCAL);
const availableFactIdsProm: Promise<Set<string>> = allFactsProm.then(allFacts => new Set(concatMap(allFacts, factToFactIds)));
