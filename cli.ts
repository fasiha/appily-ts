import {
    FactUpdate, collectKefirStream, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, FactDb
} from "./storageServer";
import { EbisuObject } from "./ebisu";

let USER = "ammy";

import { toponyms } from "./toponyms";
import { tono5k } from "./tono5k";
toponyms.setup(submit);
tono5k.setup(submit);
// Import and setup all FactDb-implementing modules!
// Then, add them to the docid2module map!
let docid2module: Map<string, FactDb> = new Map([["toponyms", toponyms], ["tono5k", tono5k]]);

async function loop(SOLE_DOCID: string = '', probThreshold: number = 0.5) {
    const levelOpts = makeLeveldbOpts(USER, SOLE_DOCID);

    let [update0, prob0]: [FactUpdate, number] = await getMostForgottenFact(levelOpts).toPromise();
    if (prob0 && prob0 <= probThreshold) {
        const docId = update0.docId;
        const factdb = docid2module.get(docId);
        const plain0 = factdb.stripFactIdOfSubfact(update0.factId);
        const allRelatedUpdates = await collectKefirStream(omitNonlatestUpdates(makeLeveldbOpts(USER, docId, plain0, true)));

        console.log("Review!", prob0);
        await factdb.administerQuiz(USER, docId, update0.factId, allRelatedUpdates);
    } else {
        if (SOLE_DOCID) {
            const factdb = docid2module.get(SOLE_DOCID);
            await factdb.findAndLearn(USER, SOLE_DOCID, await collectKefirStream(getKnownFactIds(makeLeveldbOpts(USER, SOLE_DOCID))));
        } else {
            // FIXME why Array.from required here? TypeScript problem?
            for (const [docId, factdb] of Array.from(docid2module.entries())) {
                await factdb.findAndLearn(USER, docId, await collectKefirStream(getKnownFactIds(makeLeveldbOpts(USER, docId))));
            }
        }
    }
}
loop("tono5k");
