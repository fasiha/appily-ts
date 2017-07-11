import { shuffle, sampleSize } from "lodash";

import { FactDb } from "./storageServer";
import { ebisu, EbisuObject } from "./ebisu";
import { furiganaStringToReading, parseMarkdownLinkRuby, furiganaStringToPlain, Furigana, Ruby } from "./ruby";
import { cachedUrlFetch,elapsedHours, all, concatMap } from "./utils";

const RUBY_START = '- Ruby: ';

async function urlToFuriganas(url: string, local:string): Promise<Array<Furigana[]>> {
    var text: string = await cachedUrlFetch(url,local);
    var rubyLines: string[] = text.split('\n').filter(s => s.indexOf(RUBY_START) === 0).map(s => s.slice(RUBY_START.length));
    var furiganas = rubyLines.map(parseMarkdownLinkRuby);
    return furiganas;
}

function furiganaFactToFactIds(word: Furigana[]) {
    let plain = furiganaStringToPlain(word);
    return [`${plain}-kanji`, `${plain}-reading`];
}

let TOPONYMS_URL = "https://raw.githubusercontent.com/fasiha/toponyms-and-nymes/gh-pages/README.md";
let TOPONYMS_LOCAL = "toponyms.md";
let WEB_URL = "https://fasiha.github.io/toponyms-and-nymes/";

// Initial halflife: 15 minutes: all elapsed times will be in units of hours.
const newlyLearned = ebisu.defaultModel(0.25, 2.5);
const buryForever = ebisu.defaultModel(Infinity);

const allFactsProm: Promise<Array<Furigana[]>> = urlToFuriganas(TOPONYMS_URL, TOPONYMS_LOCAL);
const availableFactIdsProm: Promise<Set<string>> = allFactsProm.then(allFacts => new Set(concatMap(allFacts, furiganaFactToFactIds)));
let submit;
let prompt : () => Promise<string>;

function setup(externalSubmitFunction: (user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject) => void,
    externaPromptFunction: ()=>Promise<string>): void {
    submit = externalSubmitFunction;
    prompt = externaPromptFunction;
}

interface FactUpdate {
    factId: string;
    ebisuObject: EbisuObject;
    createdAt: Date;
}

function factIdToURL(s: string) {
    return `${WEB_URL}#${encodeURI(stripFactIdOfSubfact(s))}`;
}

function buryFactId(USER: string, DOCID: string, factId: string, buryAll: boolean) {
    const plain = stripFactIdOfSubfact(factId);
    if (buryAll) {
        return Promise.all(furiganaFactToFactIds([plain]).map(factId => submit(USER, DOCID, factId, buryForever)));
    }
    return submit(USER, DOCID, factId, buryForever);
}

async function learnFact(USER: string, DOCID: string, fact: Furigana[], factIds: string[]) {
    console.log(`Hey! Learn this:`);
    console.log(fact);
    console.log(factIdToURL(factIds[0]));
    var start = new Date();
    console.log('http://jisho.org/search/%23kanji%20' + encodeURI(fact
        .filter((f: Furigana) => typeof (f) !== 'string')
        .map((f: Ruby) => f.ruby).join('')));
    console.log('')
    console.log('Hit Enter when you got it. (Control-C to quit without committing to learn this.)');
    var typed = await prompt();
    factIds.forEach(factId => submit(USER, DOCID, factId, newlyLearned, { firstLearned: true, hoursWaited: elapsedHours(start) }));
}

const alpha = 'ABCDEFGHIJKLM'.split('');
const HELP_READING = `Type in the reading in ひらがな (hiragana).
You can also write “bury” and you’ll never see this quiz again.
To never see any quizzes related to this fact, type “bury all”.`;
const HELP_KANJI = `This is a multiple choice test. Type in, for example, “a” or “A”. Case doesn’t matter.
You can also write “bury” and you’ll never see this quiz again.
To never see any quizzes related to this fact, type “bury all”.`;

// These promises aren’t really needed, I wait on them because I fear the program will exit before they’re resolved.
async function returnOnCommand(responseText: string, help: string, buryFact: ((boolean) => any)) {
    if (responseText.toLowerCase().indexOf('help') === 0) {
        console.log(help);
        return true;
    } else if (responseText.toLowerCase().indexOf('bury all') === 0) {
        console.log('Burying all quizzes related to this fact!')
        await buryFact(true);
        return true;
    } else if (responseText.toLowerCase().indexOf('bury') === 0) {
        console.log('Burying this quiz.')
        await buryFact(false);
        return true;
    }
    return false;
}

async function administerQuiz(USER: string, DOCID: string, factId: string, allUpdates: FactUpdate[]) {
    console.log(`¡¡¡🎆 QUIZ TIME 🎇!!!`);
    let allFacts: Array<Furigana[]> = await allFactsProm;
    let plain0 = stripFactIdOfSubfact(factId);
    let fact = allFacts.find(fact => furiganaStringToPlain(fact) === plain0);

    let makeBuryFn = (factId: string) => ((bool: boolean) => buryFactId(USER, DOCID, factId, bool));
    let info;
    let result;
    let start = new Date();
    if (factId.indexOf('-kanji') >= 0) {
        let confusers = shuffle(sampleSize(allFacts, 4).concat([fact])); // suffle after appending correct answer

        console.log(`What’s the kanji for: ${furiganaStringToReading(fact)}?`);
        confusers.forEach((fact, idx: number) => console.log(`${alpha[idx]}. ${furiganaStringToPlain(fact)}`));

        let responseText = await prompt();
        if (await returnOnCommand(responseText, HELP_KANJI, makeBuryFn(factId))) { return; }

        let responseIdx = alpha.indexOf(responseText.toUpperCase());
        if (responseIdx < 0 || responseIdx >= confusers.length) {
            console.log('Ummm… you ok?');
            return;
        }
        result = furiganaStringToPlain(confusers[responseIdx]) === furiganaStringToPlain(fact);
        info = {
            result,
            response: furiganaStringToPlain(confusers[responseIdx]),
            confusers: confusers.map(furiganaStringToPlain)
        };

    } else {
        console.log(`What’s the reading for: ${furiganaStringToPlain(fact)}`);
        let responseText = await prompt();
        if (await returnOnCommand(responseText, HELP_READING, makeBuryFn(factId))) { return; }
        result = responseText === furiganaStringToReading(fact);
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

async function findAndLearn(USER: string, DOCID: string, knownFactIds: string[]) {
    const allFacts = await allFactsProm;
    const availableFactIds = new Set(concatMap(allFacts, furiganaFactToFactIds));
    const knownIdsSet = new Set(knownFactIds.filter(s => availableFactIds.has(s)));

    let toLearnFact: Furigana[] = allFacts.find(fact => !all(furiganaFactToFactIds(fact).map(s => knownIdsSet.has(s))));
    if (toLearnFact) {
        await learnFact(USER, DOCID, toLearnFact, furiganaFactToFactIds(toLearnFact));
    } else {
        console.log(`No new facts to learn. Go outside and play!`)
    }
}

function stripFactIdOfSubfact(factId: string): string {
    return factId.split('-').slice(0, -1).join('');
}


export const toponyms: FactDb = { setup, administerQuiz, findAndLearn, stripFactIdOfSubfact };