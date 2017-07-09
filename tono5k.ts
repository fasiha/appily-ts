import { shuffle, sampleSize } from "lodash";
import fetch from "node-fetch";

import { FactDb } from "./storageServer";
import { ebisu, EbisuObject } from "./ebisu";
import { elapsedHours, all, concatMap, prompt } from "./utils";

let TONO_URL = "https://raw.githubusercontent.com/fasiha/tono-yamazaki-maekawa/master/tono.json";

const newlyLearned = ebisu.defaultModel(0.25, 2.5);
const buryForever = ebisu.defaultModel(Infinity);

const allFactsProm: Promise<Tono[]> = urlToFacts(TONO_URL);
const availableFactIdsProm: Promise<Set<string>> = allFactsProm.then(allFacts => new Set(concatMap(allFacts, factToFactIds)));
const allFactsWithKanjiProm = allFactsProm.then(allFacts => allFacts.filter((fact: Tono) => fact.kanjis.length > 0));
let submit;

function setup(externalSubmitFunction: (user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject) => void): void {
    submit = externalSubmitFunction;
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

async function urlToFacts(url: string): Promise<Tono[]> {
    var req = await fetch(url);
    return req.json();
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

    let fact: Tono = allFacts.find(fact => !all(factToFactIds(fact).map(s => knownIdsSet.has(s))));
    if (fact) {
        // await learnFact(USER, DOCID, fact, factToFactIds(fact));
        console.log(`Hey! Learn this:`, fact);
        console.log('http://jisho.org/search/%23kanji%20' + encodeURI(stringsToUniqueCharString(fact.kanjis)));
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

function endsWith(big:string, little:string):boolean{
    if (big.length < little.length) {
        return false;
        // We do this because if we just relied on lastIndexOf and compared it to difference of lengths, -1 might turn up
    }
    return big.lastIndexOf(little) === (big.length - little.length);
}

async function administerQuiz(USER: string, DOCID: string, factId: string, allUpdates: FactUpdate[]) {
    console.log(`¡¡¡🎆 QUIZ TIME 🎇!!!`);
    let allFacts: Tono[] = await allFactsProm;
    let plain0 = +stripFactIdOfSubfact(factId);
    let fact = allFacts.find(fact => fact.num === plain0);

    let info;
    let result:boolean;
    let start = new Date();
    if (endsWith(factId,'-kanji') || endsWith(factId,'-meaning')) {
        const kanjiQuiz = endsWith(factId,'-kanji') ;
        const confusers = shuffle(sampleSize(kanjiQuiz ? await allFactsWithKanjiProm : allFacts, 4).concat([fact]));

        if (kanjiQuiz) {
            console.log(`What’s the kanji for: ${fact.readings.join('・')} and meaning 「${fact.meaning}」?`);
            confusers.forEach((fact, idx: number) => console.log(`${alpha[idx]}. ${fact.kanjis.join('・')}`));
        } else {
            // meaning quiz
            console.log(`What’s the meaning of: ${kanjiQuiz ? fact.readings.join('・') + ', ' : ''}${fact.readings.join('・')}?`);
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
            confusers: confusers.map(fact=>fact.num)
        };

    } else { // reading
        if (fact.kanjis.length){            
            console.log(`What’s the reading for: ${fact.kanjis.join('・')}, 「${fact.meaning}」?`);
        } else {
            console.log(`What’s the reading for: 「${fact.meaning}」?`);
        }
        let responseText = await prompt();
        result = fact.readings.indexOf(responseText)>=0;
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
