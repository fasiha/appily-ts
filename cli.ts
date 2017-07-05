import { ebisu } from "./ebisu";
import { Furigana } from "./ruby";
import { FactUpdate, collectKefirStream, mostForgottenFact, omitNonlatestUpdates, knownFactIds, printDb, submit } from "./storageServer";
import { urlToFuriganas, furiganaFactToFactIds } from "./md2facts";
import { furiganaStringToReading, furiganaStringToPlain } from "./ruby";

let TOPONYMS_URL = "https://raw.githubusercontent.com/fasiha/toponyms-and-nymes/gh-pages/README.md";
let TOPONYMS_DOCID = "toponyms";
let USER = "ammy";
let DOCID = TOPONYMS_DOCID;

async function setup() {
    var allFacts = await urlToFuriganas(TOPONYMS_URL);
    var knownFacts = await knownFactIds(USER, TOPONYMS_DOCID);
}

async function learnFact(fact: Furigana[], factId:string) {
    // Suggest something to learn. User can either learn it or skip it to get another suggestion.
    console.log("Hey! Learn this:", fact, factId);
}

// async function lowestRecallProb() {

// }

async function administerQuiz(fact: FactUpdate) {
    // Quiz the user.
}

async function looper(probThreshold: number = 0.5) {
    const allFacts = await urlToFuriganas(TOPONYMS_URL);
    // let allFactIds = concatMap(allFacts, furiganaFactToFactIds);
    const knownFacts = await collectKefirStream(knownFactIds(USER, TOPONYMS_DOCID));
    let knownSet = new Set(knownFacts);
    while (1) {
        let [fact0, prob0]: [FactUpdate, number] = await mostForgottenFact(USER, DOCID).toPromise();
        if (prob0 && prob0 <= probThreshold) {
            // let [ebisuObject, updateObject] = await administerQuiz(fact0);
            // await submit(USER, DOCID, fact0.factId, ebisuObject, updateObject);
        } else {
            // Find first entry in `allFacts` that isn't known.
            let toLearnFact:Furigana[];
            let toLearnFactId:string;
            for (let fact of allFacts) {
                let ids = furiganaFactToFactIds(fact);
                let unknownId=ids.findIndex(id=>!knownSet.has(id));
                if (unknownId>=0) {
                    toLearnFact = fact;
                    toLearnFactId = ids[unknownId];
                    break;
                }
            }
            if (toLearnFact) {
                learnFact(toLearnFact, toLearnFactId);
            } else {
                console.log(`No facts left to learn or review (π=${fact0?prob0:'none'}). Go outside and play!`)
                break;
            }
        }
    }
}
looper()


// Initial halflife: 15 minutes: all elapsed times will be in units of hours.
var o = ebisu.defaultModel(0.25, 2.5);

// function concatMap<T, U>(arr: T[], f: (x: T) => U[]): U[] {
//     let ret = [];
//     for (let x of arr) {
//         ret = ret.concat(f(x));
//     }
//     return ret;
// }
