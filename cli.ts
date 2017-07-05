import { ebisu } from "./ebisu";
import { FactUpdate, mostForgottenFact, omitNonlatestUpdates, knownFactIds, printDb, submit } from "./storageServer";
import { urlToFuriganas, furiganaFactToFactId } from "./md2facts";
import { furiganaStringToReading, furiganaStringToPlain } from "./ruby";

let TOPONYMS_URL = "https://raw.githubusercontent.com/fasiha/toponyms-and-nymes/gh-pages/README.md";
let TOPONYMS_DOCID = "toponyms";
let USER = "ammy";
let DOCID = TOPONYMS_DOCID;

async function setup() {
    var allFacts = await urlToFuriganas(TOPONYMS_URL);
    var knownFacts = await knownFactIds(USER, TOPONYMS_DOCID);
}

async function suggestNextToLearn(fact: FactUpdate) {
    // Suggest something to learn. User can either learn it or skip it to get another suggestion.
}

// async function lowestRecallProb() {

// }

async function administerQuiz(fact: FactUpdate) {
    // Quiz the user.
}

function concatMap<T, U>(arr: T[], f: (x: T) => U[]): U[] {
    let ret = [];
    for (let x of arr) {
        ret = ret.concat(f(x));
    }
    return ret;
}

async function looper(probThreshold: number = 0.5) {
    let allFacts = await urlToFuriganas(TOPONYMS_URL);
    let allFactIds = concatMap(allFacts, furiganaFactToFactId);
    let knownFacts = await knownFactIds(USER, TOPONYMS_DOCID);
    while (1) {
        let [fact0, prob0]: [FactUpdate, number] = await mostForgottenFact(USER, DOCID).toPromise();
        if (prob0 <= probThreshold) {
            // let [ebisuObject, updateObject] = await administerQuiz(fact0);
            // await submit(USER, DOCID, fact0.factId, ebisuObject, updateObject);
        } else {
            // Find first entry in allFacts that isn't known.
            // knownFactIds(USER, DOCID);
        }
    }
}


// Initial halflife: 15 minutes: all elapsed times will be in units of hours.
var o = ebisu.defaultModel(0.25, 2.5);
console.log("EBISU", o)
console.log("PRED", ebisu.predictRecall(o, 22.5));
console.log("PRED", ebisu.updateRecall(o, true, 24));
console.log("PRED", ebisu.updateRecall(o, false, 24));
