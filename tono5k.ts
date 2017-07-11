import { shuffle, sampleSize } from "lodash";

import { FactDb } from "./storageServer";
import { ebisu, EbisuObject } from "./ebisu";
import {cachedUrlFetch, dedupeViaSets, endsWith, elapsedHours, all, any, concatMap } from "./utils";
import { furiganaStringToPlain, parseJmdictFurigana } from "./ruby";

const TONO_URL = "https://raw.githubusercontent.com/fasiha/tono-yamazaki-maekawa/master/tono.json";
const TONO_LOCAL = 'tono.json';

const newlyLearned = ebisu.defaultModel(0.25, 2.5);
const buryForever = ebisu.defaultModel(Infinity);

const allFactsProm: Promise<Tono[]> = urlToFacts(TONO_URL, TONO_LOCAL);
const availableFactIdsProm: Promise<Set<string>> = allFactsProm.then(allFacts => new Set(concatMap(allFacts, factToFactIds)));
const allFactsWithKanjiProm = allFactsProm.then(allFacts => allFacts.filter((fact: Tono) => fact.kanjis.length > 0));
let submit  : (user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject) => void;
let prompt : () => Promise<string>;

function setup(externalSubmitFunction: (user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject) => void,
    externalPromptFunction: ()=>Promise<string>): void {
    submit = externalSubmitFunction;
    prompt = externalPromptFunction;
}

function stripFactIdOfSubfact(factId: string): string {
    return factId.split('-').slice(0, -1).join('');
}

interface Tono {
    readings: string[];
    meaning: string;
    kanjis: string[];
    roumaji: string;
    num: number;
    freq: number;
    disp: number;
    register?: string;
}

async function urlToFacts(url: string, local:string): Promise<Tono[]> {
    let json: Tono[] = JSON.parse(await cachedUrlFetch(url, local));
    return json.map(tono => {
        tono.kanjis = dedupeViaSets(tono.kanjis.map(k => furiganaStringToPlain(parseJmdictFurigana(k))));
        return tono;
    })
}

function factToFactIds(fact: Tono): string[] {
    const plain = fact.num;
    if (fact.kanjis.length > 0) {
        return 'kanji,reading,meaning'.split(',').map(sub => `${plain}-${sub}`);
    }
    return 'reading,meaning'.split(',').map(sub => `${plain}-${sub}`);
}

export const tono5k: FactDb = { setup, stripFactIdOfSubfact, administerQuiz, findAndLearn };

function stringsToUniqueCharString(arr: string[]) {
    return Array.from(new Set(arr.join('').split(''))).join('');
}

async function findAndLearn(USER: string, DOCID: string, knownFactIds: string[]) {
    const allFacts = await allFactsProm;
    const availableFactIds = new Set(concatMap(allFacts, factToFactIds));
    const knownIdsSet = new Set(knownFactIds.filter(s => availableFactIds.has(s)));

    // Only look for the following parts of speech:
    const lookFors = 'n.,v.,adj.,adv.,pron.,adn.'.split(',');
    let fact: Tono = allFacts.find(fact => lookFors.findIndex(pos => fact.meaning.includes(pos)) >= 0
        && !all(factToFactIds(fact).map(s => knownIdsSet.has(s))));

    if (fact) {
        // await learnFact(USER, DOCID, fact, factToFactIds(fact));
        console.log(`Hey! Learn this:`);
        console.log(fact);
        if (fact.kanjis.length) {
            console.log('http://jisho.org/search/%23kanji%20' + encodeURI(stringsToUniqueCharString(fact.kanjis)));
        }
        console.log('Hit Enter when you got it. (Control-C to quit without committing to learn this.)');
        const start = new Date();
        const typed = await prompt();
        const factIds = factToFactIds(fact);
        factIds.forEach(factId => submit(USER, DOCID, factId, newlyLearned, { firstLearned: true, hoursWaited: elapsedHours(start) }));


    } else {
        console.log(`No new facts to learn. Go outside and play!`)
    }
}




const alpha = 'ABCDEFGHIJKLM'.split('');

async function administerQuiz(USER: string, DOCID: string, factId: string, allUpdates: FactUpdate[]) {
    console.log(`¡¡¡🎆 QUIZ TIME 🎇!!!`);
    let allFacts: Tono[] = await allFactsProm;
    let plain0 = +stripFactIdOfSubfact(factId);
    let fact = allFacts.find(fact => fact.num === plain0);

    let info;
    let result: boolean;
    let start = new Date();
    if (endsWith(factId, '-kanji') || endsWith(factId, '-meaning')) {
        const kanjiQuiz = endsWith(factId, '-kanji');
        const confusers = shuffle(sampleSize(kanjiQuiz ? await allFactsWithKanjiProm : allFacts, 4).concat([fact]));

        if (kanjiQuiz) {
            console.log(`What’s the kanji for: ${fact.readings.join('・')} and meaning 「${fact.meaning}」?`);
            confusers.forEach((fact, idx: number) => console.log(`${alpha[idx]}. ${fact.kanjis.join('・')}`));
        } else {
            // meaning quiz
            console.log(`What’s the meaning of: ${fact.kanjis.length ? fact.kanjis.join('・') + ', ' : ''}${fact.readings.join('・')}?`);
            confusers.forEach((fact, idx) => console.log(`${alpha[idx]}. ${fact.meaning}`));
        }

        const responseText = await prompt();
        const responseIdx = alpha.indexOf(responseText.toUpperCase());
        if (responseIdx < 0 || responseIdx >= confusers.length) {
            console.log('Ummm… you ok?');
            return;
        }

        result = confusers[responseIdx].num === fact.num;
        info = {
            result,
            response: confusers[responseIdx].num,
            confusers: confusers.map(fact => fact.num)
        };

    } else { // reading
        if (fact.kanjis.length) {
            console.log(`What’s the reading for: ${fact.kanjis.join('・')}, 「${fact.meaning}」?`);
        } else {
            console.log(`What’s the reading for: 「${fact.meaning}」?`);
        }
        let responseText = await prompt();
        result = fact.readings.indexOf(responseText) >= 0;
        info = { result, response: responseText };
    }
    info.hoursWaited = elapsedHours(start);
    for (let u of allUpdates) {
        if (u.factId === factId) {
            // active update
            info.wasActiveRecall = true;
            let newEbisu = ebisu.updateRecall(u.ebisuObject, result, elapsedHours(new Date(u.createdAt)));
            await submit(USER, DOCID, factId, newEbisu, info);
        } else {
            // passive update: update the timestamp, keep the ebisu prior the same.
            info.wasActiveRecall = false;
            await submit(USER, DOCID, u.factId, u.ebisuObject, info);
        }
    }
    if (result) { console.log('✅✅✅!'); }
    else { console.log('❌❌❌', fact); }
}

interface FactUpdate {
    factId: string;
    ebisuObject: EbisuObject;
    createdAt: Date;
}
