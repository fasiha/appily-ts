import { ebisu } from "./ebisu";
import { Furigana, Ruby } from "./ruby";
import { FactUpdate, collectKefirStream, mostForgottenFact, omitNonlatestUpdates, knownFactIds, printDb, submit } from "./storageServer";
import { urlToFuriganas, furiganaFactToFactIds } from "./md2facts";
import { furiganaStringToReading, furiganaStringToPlain } from "./ruby";

let TOPONYMS_URL = "https://raw.githubusercontent.com/fasiha/toponyms-and-nymes/gh-pages/README.md";
let WEB_URL = "https://fasiha.github.io/toponyms-and-nymes/";
let TOPONYMS_DOCID = "toponyms";
let USER = "ammy";
let DOCID = TOPONYMS_DOCID;

async function setup() {
    var allFacts = await urlToFuriganas(TOPONYMS_URL);
    var knownFacts = await knownFactIds(USER, TOPONYMS_DOCID);
}

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
    // Suggest something to learn. User can either learn it or skip it to get another suggestion.
    console.log(`Hey! Learn this:`, fact);
    console.log(factIdToURL(factIds[0]));
    fact.filter((f: Furigana) => typeof (f) !== 'string')
        .forEach((f: Ruby) => console.log(`${f.ruby}: http://jisho.org/search/${encodeURI(f.ruby)}%20%23kanji`));
    console.log('')
    console.log('Type something if you got it.');
    var typed = await prompt();
    factIds.forEach(factId => submit(USER, DOCID, factId, newlyLearned));
}

// async function lowestRecallProb() {

// }

async function administerQuiz(fact: FactUpdate) {
    // Quiz the user.
}

async function loop(probThreshold: number = 0.5) {
    const allFacts = await urlToFuriganas(TOPONYMS_URL);
    // let allFactIds = concatMap(allFacts, furiganaFactToFactIds);
    const knownFacts = await collectKefirStream(knownFactIds(USER, TOPONYMS_DOCID));
    let knownSet = new Set(knownFacts);
    let [fact0, prob0]: [FactUpdate, number] = await mostForgottenFact(USER, DOCID).toPromise();
    if (prob0 && prob0 <= probThreshold) {
        // let [ebisuObject, updateObject] = await administerQuiz(fact0);
        // await submit(USER, DOCID, fact0.factId, ebisuObject, updateObject);
        console.log("Review!")
    } else {
        // Find first entry in `allFacts` that isn't known.
        let toLearnFact: Furigana[];
        let toLearnFactId: string;
        for (let fact of allFacts) {
            let ids = furiganaFactToFactIds(fact);
            let unknownId = ids.findIndex(id => !knownSet.has(id));
            if (unknownId >= 0) {
                toLearnFact = fact;
                toLearnFactId = ids[unknownId];
                break;
            }
        }
        if (toLearnFact) {
            await learnFact(toLearnFact, furiganaFactToFactIds(toLearnFact));
        } else {
            console.log(`No facts left to learn or review (π=${fact0 ? prob0 : 'none'}). Go outside and play!`)
        }
    }
}
loop()


// Initial halflife: 15 minutes: all elapsed times will be in units of hours.
var newlyLearned = ebisu.defaultModel(0.25, 2.5);

// function concatMap<T, U>(arr: T[], f: (x: T) => U[]): U[] {
//     let ret = [];
//     for (let x of arr) {
//         ret = ret.concat(f(x));
//     }
//     return ret;
// }
