import {
    FactUpdate, getMostForgottenFact, getCurrentUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, FactDb, doneQuizzing
} from "./storageServer";
import { db } from "./diskDb";
import { ebisu, EbisuObject } from "./ebisu";
import { xstreamToPromise, cliPrompt, elapsedHours } from "./utils";
import { FactDbCli, SubmitFunction, DoneQuizzingFunction } from "./cliInterface";
import xs from 'xstream';

let USER = 'Zok4J4riZWgWNhKQ';
const PROB_THRESH = 0.25;

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponymsCli } from "./toponyms-cli";
import { tono5kCli } from "./tono5k-cli";
let docid2module: Map<string, FactDbCli> = new Map([["toponyms", toponymsCli], ["tono5k", tono5kCli]]);


function makeSubmitFunction(db, user, docId) {
    const f: SubmitFunction = async function (factId: string, ebisuObject: EbisuObject, updateObject: any): Promise<void> {
        return submit(db, user, docId, factId, ebisuObject, updateObject);
    };
    return f;
}

function makeDoneQuizzingFunction(db, user, docId) {
    const g: DoneQuizzingFunction = async function (factId: string, allUpdates: FactUpdate[], info: any): Promise<void> {
        return doneQuizzing(db, user, docId, factId, allUpdates, info);
    };
    return g;
}

async function loop(SOLE_DOCID: string = '') {
    const levelOpts = makeLeveldbOpts(USER, SOLE_DOCID);

    let [update0, prob0]: [FactUpdate, number] = (await xstreamToPromise(getMostForgottenFact(db, levelOpts)))[0];
    if (prob0 && prob0 <= PROB_THRESH) {
        const docId = update0.docId;
        const factdb = docid2module.get(docId);
        const plain0 = factdb.stripFactIdOfSubfact(update0.factId);
        const allRelatedUpdates = await xstreamToPromise(getCurrentUpdates(db, makeLeveldbOpts(USER, docId, plain0, true)));

        console.log("Review!", prob0);
        await factdb.administerQuiz(makeDoneQuizzingFunction(db, USER, docId), update0.factId, allRelatedUpdates);
    } else {
        if (SOLE_DOCID) {
            const factdb = docid2module.get(SOLE_DOCID);
            await factdb.findAndLearn(makeSubmitFunction(db, USER, SOLE_DOCID), await xstreamToPromise(getKnownFactIds(db, makeLeveldbOpts(USER, SOLE_DOCID))));
        } else {
            // FIXME why Array.from required here? TypeScript problem?
            for (const [docId, factdb] of Array.from(docid2module.entries())) {
                await factdb.findAndLearn(makeSubmitFunction(db, USER, docId), await xstreamToPromise(getKnownFactIds(db, makeLeveldbOpts(USER, docId))));
            }
        }
    }
}

if (require.main === module) {
    if (process.argv.length <= 2) {
        loop();
    } else {
        let t = process.argv[2];
        if (docid2module.has(t)) {
            loop(t);
        } else {
            console.log(`Couldn't find fact-document “${t}”. Available:`)
            console.log(Array.from(docid2module.keys()).map(s => '- ' + s).join('\n'));
            console.log('Running standard setup.')
            loop();
        }
    }
}
