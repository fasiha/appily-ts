import { ebisu } from "./ebisu";
import { Furigana, Ruby } from "./ruby";
import {
    FactUpdate, collectKefirStream, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, printDb, submit
} from "./storageServer";
import { urlToFuriganas, furiganaFactToFactIds } from "./md2facts";
import { furiganaStringToReading, furiganaStringToPlain } from "./ruby";

import { shuffle, sampleSize } from "lodash";

let TOPONYMS_URL = "https://raw.githubusercontent.com/fasiha/toponyms-and-nymes/gh-pages/README.md";
let WEB_URL = "https://fasiha.github.io/toponyms-and-nymes/";
let TOPONYMS_DOCID = "toponyms";
let USER = "ammy";
let DOCID = TOPONYMS_DOCID;

function factIdToURL(s: string) {
    return `${WEB_URL}#${encodeURI(s.split('-')[0])}`;
}

function prompt(): Promise<string> {
    return new Promise((resolve, reject) => {
        var stdin = process.stdin,
            stdout = process.stdout;
        stdin.resume();
        stdout.write('> ');
        stdin.once('data', data => {
            resolve(data.toString().trim());
            stdin.pause();
        });
    });
}

async function learnFact(fact: Furigana[], factIds: string[]) {
    console.log(`Hey! Learn this:`, fact);
    console.log(factIdToURL(factIds[0]));
    var start = new Date();
    fact.filter((f: Furigana) => typeof (f) !== 'string')
        .forEach((f: Ruby) => console.log(`${f.ruby}: http://jisho.org/search/${encodeURI(f.ruby)}%20%23kanji`));
    console.log('')
    console.log('Type something if you got it.');
    var typed = await prompt();
    factIds.forEach(factId => submit(USER, DOCID, factId, newlyLearned, { firstLearned: true, hoursWaited: elapsedHours(start) }));
}

const elapsedHours = (d: Date, dnow?: Date) => (((dnow || new Date()) as any) - (d as any)) / 3600e3 as number;

async function administerQuiz(fact: Furigana[], factId: string, allUpdates: FactUpdate[],
    allFacts: Array<Furigana[]>) {
    console.log(`¡¡¡🎆 QUIZ TIME 🎇!!!`);
    let info;
    let result;
    let start = new Date();
    if (factId.indexOf('-kanji') >= 0) {
        const alpha = 'ABCDEFGHIJKLM'.split('');
        let confusers = shuffle(sampleSize(allFacts, 4).concat([fact]));
        console.log(`What’s the kanji for: ${furiganaStringToReading(fact)}?`);
        confusers.forEach((fact, idx: number) => console.log(`${alpha[idx]}. ${furiganaStringToPlain(fact)}`));
        let responseText = await prompt();
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
        result = responseText === furiganaStringToReading(fact);
        info = { result, response: responseText };
    }
    // console.log("INFO", info);
    info.hoursWaited = elapsedHours(start);
    for (let u of allUpdates) {
        if (u.factId === factId) {
            // active update
            info.wasActiveRecall = true;
            let newEbisu = ebisu.updateRecall(u.ebisuObject, result, elapsedHours(new Date(u.createdAt)));
            submit(USER, DOCID, factId, newEbisu, info);
        } else {
            // passive update: update the timestamp, keep the ebisu prior the same.
            info.wasActiveRecall = false;
            submit(USER, DOCID, u.factId, u.ebisuObject, info);
        }
    }
    if (result) { console.log('✅✅✅!'); }
    else { console.log('❌❌❌'); }
}

async function loop(probThreshold: number = 0.5) {
    let levelOpts = makeLeveldbOpts(USER, DOCID);

    const allFacts = await urlToFuriganas(TOPONYMS_URL);

    const knownFactIds = await collectKefirStream(getKnownFactIds(levelOpts));
    let knownIdsSet = new Set(knownFactIds);

    let [update0, prob0]: [FactUpdate, number] = await getMostForgottenFact(levelOpts).toPromise();
    if (prob0 && prob0 <= probThreshold) {
        var plain0 = update0.factId.split('-')[0];
        let fact0 = allFacts.find(fact => furiganaStringToPlain(fact) === plain0);
        // FIXME what happens if this isn’t found? I.e., a fact that was learned and then removed from the syllabus?
        var allRelatedUpdates = await collectKefirStream(omitNonlatestUpdates(makeLeveldbOpts(USER, DOCID, plain0, true)));

        console.log("Review!", prob0);
        await administerQuiz(fact0, update0.factId, allRelatedUpdates, allFacts);
    } else {
        // Find first entry in `allFacts` that isn't known.
        let toLearnFact: Furigana[];
        allFacts.find
        for (let fact of allFacts) {
            let ids = furiganaFactToFactIds(fact);
            let unknownId = ids.findIndex(id => !knownIdsSet.has(id));
            if (unknownId >= 0) {
                toLearnFact = fact;
                break;
            }
        }
        if (toLearnFact) {
            await learnFact(toLearnFact, furiganaFactToFactIds(toLearnFact));
        } else {
            console.log(`No facts left to learn or review (π=${update0 ? prob0 : 'none'}). Go outside and play!`)
        }
    }
}
loop();

// Initial halflife: 15 minutes: all elapsed times will be in units of hours.
var newlyLearned = ebisu.defaultModel(0.25, 2.5);
