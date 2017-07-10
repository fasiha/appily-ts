import { shuffle, sampleSize } from "lodash";
import { readFileSync } from "fs";

import { FactDb } from "./storageServer";
import { ebisu, EbisuObject } from "./ebisu";
import { endsWith, elapsedHours, all, any, concatMap, prompt } from "./utils";

let RAW_PATH = "dbjg.json";

const newlyLearned = ebisu.defaultModel(0.25, 2.5);
const buryForever = ebisu.defaultModel(Infinity);

const allFactsProm: Promise<Sentence[]> = pathToFacts(RAW_PATH);
const availableFactIdsProm: Promise<Set<string>> = allFactsProm.then(allFacts => new Set(concatMap(allFacts, factToFactIds)));
let submit;

function setup(externalSubmitFunction: (user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject) => void): void {
    submit = externalSubmitFunction;
}

function stripFactIdOfSubfact(factId: string): string {
    return factId;
}

interface Sentence {
    expression: string;
    translation: string;
    reading: string;
    grammarj: string;
    grammare: string;
    grammar: string;
}

async function pathToFacts(path: string): Promise<Sentence[]> {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function factToFactIds(fact: Sentence): string[] {
    return [fact.expression];
}

export const dbjg: FactDb = { setup, stripFactIdOfSubfact, administerQuiz, findAndLearn };

function stringsToUniqueCharString(arr: string[]) {
    return Array.from(new Set(arr.join('').split(''))).join('');
}

async function findAndLearn(USER: string, DOCID: string, knownFactIds: string[]) {
    const allFacts = await allFactsProm;
    const availableFactIds = new Set(concatMap(allFacts, factToFactIds));
    const knownIdsSet = new Set(knownFactIds.filter(s => availableFactIds.has(s)));

    // Only look for the following parts of speech:
    const lookFors = 'n.,v.,adj.,adv.,pron.,adn.'.split(',');
    let fact: Sentence = allFacts.find(fact => !all(factToFactIds(fact).map(s => knownIdsSet.has(s))));

    if (fact) {
        console.log(`Hey! Learn this:`);
        console.log(fact);
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

function leftpad(n: number, nchars: number, pad: string = ' ') {
    const s = n.toString();
    return pad.repeat(Math.max(0, nchars - s.length)) + s;
}

async function administerQuiz(USER: string, DOCID: string, factId: string, allUpdates: FactUpdate[]) {
    console.log(`¡¡¡🎆 QUIZ TIME 🎇!!!`);
    let allFacts: Sentence[] = await allFactsProm;
    let fact = allFacts.find(fact => fact.expression === factId);

    console.log(`English translation: “${fact.translation}”`);
    const shuffled = shuffle(fact.expression.split(''));
    shuffled.forEach((c: string, i: number) => console.log(`${leftpad(i + 1, 2)}: ${c}`));

    let info;
    let result: boolean;
    let start = new Date();

    while (1) {
        console.log('Type in numbers:')
        const resp = await prompt();
        const idxs = resp.split(/\D+/).map(s => parseFloat(s) - 1);
        const reconstructed = idxs.map(i => shuffled[i]).join('');
        if (idxs.length !== shuffled.length) {
            console.log(`Your answer is incomplete (need ${shuffled.length - idxs.length} more):\n「${reconstructed}」`);
            console.log('Try again.');
            continue;
        }
        console.log(`Your answer: 「${reconstructed}」`);
        console.log('Hit [Enter] to confirm, or something else to try again.')
        const confirm = await prompt();
        if (confirm === '') {
            result = reconstructed === fact.expression;
            info.response = resp;
            info.reconstructed = reconstructed;
            break;
        }
    }
    info.hoursWaited = elapsedHours(start);
    const u = allUpdates[0];
    let newEbisu = ebisu.updateRecall(u.ebisuObject, result, elapsedHours(new Date(u.createdAt)));
    await submit(USER, DOCID, factId, newEbisu, info);
    if (result) { console.log('✅✅✅!'); }
    else { console.log('❌❌❌', fact); }
}

interface FactUpdate {
    factId: string;
    ebisuObject: EbisuObject;
    createdAt: Date;
}
