import { omitNonlatestUpdates, knownFactIds, printDb, submit } from "./storageServer";
import { urlToFuriganas } from "./md2facts";
import { furiganaStringToReading, furiganaStringToPlain } from "./ruby";

let TOPONYMS_URL = "https://raw.githubusercontent.com/fasiha/toponyms-and-nymes/gh-pages/README.md";
let TOPONYMS_DOCID = "toponyms";
let USER = "ammy";

async function setup() {
    var allFacts = await urlToFuriganas(TOPONYMS_URL);
    var knownFacts = await knownFactIds(USER, TOPONYMS_DOCID);
}

async function suggestNextToLearn() {
    // Suggest something to learn. User can either learn it or skip it to get another suggestion.
}

async function quiz() {
    // Quiz the user.
}