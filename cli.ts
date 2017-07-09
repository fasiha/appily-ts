import {
    FactUpdate, collectKefirStream, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit
} from "./storageServer";
import {toponyms } from "./toponyms";
import { EbisuObject } from "./ebisu";


let USER = "ammy";
let DOCID = "toponyms";

toponyms.setup(submit);

async function loop(probThreshold: number = 0.5) {
    const levelOpts = makeLeveldbOpts(USER, DOCID);

    let [update0, prob0]: [FactUpdate, number] = await getMostForgottenFact(levelOpts).toPromise();
    if (prob0 && prob0 <= probThreshold) {
        var plain0 = update0.factId.split('-')[0];
        var allRelatedUpdates = await collectKefirStream(omitNonlatestUpdates(makeLeveldbOpts(USER, DOCID, plain0, true)));

        console.log("Review!", prob0);
        await toponyms.administerQuiz(USER, DOCID, update0.factId, allRelatedUpdates);
    } else {
        toponyms.findAndLearn(USER, DOCID, await collectKefirStream(getKnownFactIds(levelOpts)))
    }
}
loop();


