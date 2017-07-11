import {
    FactUpdate, collectKefirStream, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, FactDb, db
} from "./storageServer";
import { EbisuObject } from "./ebisu";
import { prompt } from "./utils";

let USER = "ammy";

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponyms } from "./toponyms";
import { tono5k } from "./tono5k";
let docid2module: Map<string, FactDb> = new Map([["toponyms", toponyms], ["tono5k", tono5k]]);

async function cliSubmit(user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) {
    return submit(db, user, docId, factId, ebisuObject, updateObject);
}
Array.from(docid2module.values()).forEach(factdb => factdb.setup(cliSubmit, prompt));

async function loop(SOLE_DOCID: string = '', probThreshold: number = 0.5) {
    const levelOpts = makeLeveldbOpts(USER, SOLE_DOCID);

    let [update0, prob0]: [FactUpdate, number] = await getMostForgottenFact(db, levelOpts).toPromise();
    if (prob0 && prob0 <= probThreshold) {
        const docId = update0.docId;
        const factdb = docid2module.get(docId);
        const plain0 = factdb.stripFactIdOfSubfact(update0.factId);
        const allRelatedUpdates = await collectKefirStream(omitNonlatestUpdates(db, makeLeveldbOpts(USER, docId, plain0, true)));

        console.log("Review!", prob0);
        await factdb.administerQuiz(USER, docId, update0.factId, allRelatedUpdates);
    } else {
        if (SOLE_DOCID) {
            const factdb = docid2module.get(SOLE_DOCID);
            await factdb.findAndLearn(USER, SOLE_DOCID, await collectKefirStream(getKnownFactIds(db, makeLeveldbOpts(USER, SOLE_DOCID))));
        } else {
            // FIXME why Array.from required here? TypeScript problem?
            for (const [docId, factdb] of Array.from(docid2module.entries())) {
                await factdb.findAndLearn(USER, docId, await collectKefirStream(getKnownFactIds(db, makeLeveldbOpts(USER, docId))));
            }
        }
    }
}
// loop("tono5k");

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
