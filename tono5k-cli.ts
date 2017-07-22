import { FactUpdate, FactDb } from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { endsWith, elapsedHours } from "./utils";
import { cliPrompt } from "./node-utils";
import { Tono, HowToQuizInfo, tono5k } from "./tono5k";
import { FactDbCli, SubmitFunction, DoneQuizzingFunction } from "./cliInterface";

const newlyLearned = ebisu.defaultModel(0.25, 2.5);
const buryForever = ebisu.defaultModel(Infinity);

export const tono5kCli: FactDbCli = { administerQuiz, findAndLearn, stripFactIdOfSubfact: tono5k.stripFactIdOfSubfact };

async function findAndLearn(submit: SubmitFunction, knownFactIds: string[]): Promise<void> {
    let fact: Tono = await tono5k.whatToLearn(knownFactIds);

    if (fact) {
        console.log(`Hey! Learn this:`);
        console.log(fact);
        if (fact.kanjis.length) {
            console.log('http://jisho.org/search/%23kanji%20' + encodeURI(stringsToUniqueCharString(fact.kanjis)));
        }
        console.log('Hit Enter when you got it. (Control-C to quit without committing to learn this.)');
        const start = new Date();
        const typed = await cliPrompt();
        const factIds = tono5k.factToFactIds(fact);
        factIds.forEach(factId => submit(factId, newlyLearned, { firstLearned: true, hoursWaited: elapsedHours(start) }));
    } else {
        console.log(`No new facts to learn. Go outside and play!`)
    }
}

interface DoneQuizzingInfo {
    result: boolean;
    wasActiveRecall?: boolean;
    response?: any;
    confusers?: number[]; //Tono number
    hoursWaited?: number;
};

async function administerQuiz(doneQuizzing: DoneQuizzingFunction, factId: string, allUpdates: FactUpdate[]) {
    console.log(`¡¡¡🎆 QUIZ TIME 🎇!!!`);

    let quiz: HowToQuizInfo = await tono5k.howToQuiz(factId);
    let fact = quiz.fact;
    const alpha = 'ABCDEFGHIJKLM'.split('');

    let info: DoneQuizzingInfo;
    let result: boolean;
    let start = new Date();
    if (endsWith(factId, '-kanji') || endsWith(factId, '-meaning')) {
        if (endsWith(factId, '-kanji')) {
            console.log(`What’s the kanji for: ${fact.readings.join('・')} and meaning 「${fact.meaning}」?`);
            quiz.confusers.forEach((fact, idx: number) => console.log(`${alpha[idx]}. ${fact.kanjis.join('・')}`));
        } else {
            // meaning quiz
            console.log(`What’s the meaning of: ${fact.kanjis.length ? fact.kanjis.join('・') + ', ' : ''}${fact.readings.join('・')}?`);
            quiz.confusers.forEach((fact, idx) => console.log(`${alpha[idx]}. ${fact.meaning}`));
        }

        const responseText = await cliPrompt();
        const responseIdx = alpha.indexOf(responseText.toUpperCase());
        if (responseIdx < 0 || responseIdx >= quiz.confusers.length) {
            console.log('Ummm… you ok?');
            return;
        }

        result = quiz.confusers[responseIdx].num === fact.num;
        info = {
            result,
            response: quiz.confusers[responseIdx].num,
            confusers: quiz.confusers.map(fact => fact.num)
        };
    } else { // reading
        if (fact.kanjis.length) {
            console.log(`What’s the reading for: ${fact.kanjis.join('・')}, 「${fact.meaning}」?`);
        } else {
            console.log(`What’s the reading for: 「${fact.meaning}」?`);
        }
        let responseText = await cliPrompt();
        result = fact.readings.indexOf(responseText) >= 0;
        info = { result, response: responseText };
    }
    info.hoursWaited = elapsedHours(start);

    await doneQuizzing(factId, allUpdates, info);

    if (result) { console.log('✅✅✅!'); }
    else { console.log('❌❌❌', fact); }
}

function stringsToUniqueCharString(arr: string[]) {
    return Array.from(new Set(arr.join('').split(''))).join('');
}
