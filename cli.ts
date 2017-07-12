import {
    FactUpdate, collectKefirStream, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, FactDb, doneQuizzing
} from "./storageServer";
import { db } from "./diskDb";
import { ebisu, EbisuObject } from "./ebisu";
import { prompt, elapsedHours } from "./utils";

let USER = "ammy";

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponyms } from "./toponyms";
import { tono5kCli } from "./tono5k-cli";
let docid2module: Map<string, FactDbCli> = new Map([/*["toponyms", toponyms],*/["tono5k", tono5kCli]]);

collectKefirStream(getKnownFactIds(db)).then(x => console.log(x))

export interface FactDbCli {
    administerQuiz: (db, USER: string, docId: string, factId: string, allRelatedUpdates: FactUpdate[]) => Promise<void>;
    stripFactIdOfSubfact: (factId: string) => string;
    findAndLearn: (submit: SubmitFunction, USER: string, DOCID: string, knownFactIds: string[]) => Promise<void>;
}

type SubmitFunction = (user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) => Promise<void>;
async function cliSubmit(user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) {
    return submit(db, user, docId, factId, ebisuObject, updateObject);
}

async function loop(SOLE_DOCID: string = '', probThreshold: number = 0.5) {
    const levelOpts = makeLeveldbOpts(USER, SOLE_DOCID);

    let [update0, prob0]: [FactUpdate, number] = await getMostForgottenFact(db, levelOpts).toPromise();
    if (prob0 && prob0 <= probThreshold) {
        const docId = update0.docId;
        const factdb = docid2module.get(docId);
        const plain0 = factdb.stripFactIdOfSubfact(update0.factId);
        const allRelatedUpdates = await collectKefirStream(omitNonlatestUpdates(db, makeLeveldbOpts(USER, docId, plain0, true)));

        console.log("Review!", prob0);
        await factdb.administerQuiz(db, USER, docId, update0.factId, allRelatedUpdates);
    } else {
        if (SOLE_DOCID) {
            const factdb = docid2module.get(SOLE_DOCID);
            await factdb.findAndLearn(cliSubmit, USER, SOLE_DOCID, await collectKefirStream(getKnownFactIds(db, makeLeveldbOpts(USER, SOLE_DOCID))));
        } else {
            // FIXME why Array.from required here? TypeScript problem?
            for (const [docId, factdb] of Array.from(docid2module.entries())) {
                await factdb.findAndLearn(cliSubmit, USER, docId, await collectKefirStream(getKnownFactIds(db, makeLeveldbOpts(USER, docId))));
            }
        }
    }
}

if (require.main === module) {
    if (process.argv.length <= 2) {
        loop('', .1);
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
