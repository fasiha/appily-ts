import bluebird = require('bluebird');

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import isolate from '@cycle/isolate';
import { run } from '@cycle/run';
import { div, button, p, ol, li, span, input, form, makeDOMDriver, VNode } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'

import {
    FactUpdate, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, doneQuizzing, FactDb
} from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import { WhatToLearnInfo, WhatToQuizInfo, FactDbCycle } from "./cycleInterfaces";

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponymsCyclejs } from "./toponyms-cyclejs";
import { tono5kCyclejs } from "./tono5k-cyclejs";
import { scramblerCyclejs } from "./scrambler-cyclejs";
const docid2module: Map<string, FactDbCycle> = new Map([
    // ["toponyms", toponymsCyclejs],
    // ["tono5k", tono5kCyclejs],
    ["scrambler", scramblerCyclejs]
]);

const USER = "ammy";
const PROB_THRESH = 0.9995;
const newlyLearned = ebisu.defaultModel(0.25, 2.5);

// Database

type Db = any;

const shoe = require('shoe');
const multilevel = require('multilevel');
// const db: Db = multilevel.client();

bluebird.promisifyAll(db);

const stream = shoe('/api/ml', function() {
    console.log("Connected.");
});
stream.pipe(db.createRpcStream()).pipe(stream);

// Wrapper around all fact databases

async function webSubmit(user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) {
    return submit(db, user, docId, factId, ebisuObject, updateObject);
}

async function whatToQuiz(db, user: string, soleDocId: string = ''): Promise<WhatToQuizInfo> {

    let [update0, prob0]: [FactUpdate, number] = (await xstreamToPromise(getMostForgottenFact(db, makeLeveldbOpts(user, soleDocId))))[0];

    if (prob0 && prob0 <= PROB_THRESH && docid2module.has(update0.docId)) {
        const docId = update0.docId;
        const factdb = docid2module.get(docId);
        const plain0 = factdb.stripFactIdOfSubfact(update0.factId);
        const allRelatedUpdates = await xstreamToPromise(omitNonlatestUpdates(db, makeLeveldbOpts(user, docId, plain0, true)));
        return { risky: true, prob: prob0, update: update0, allRelatedUpdates, factId: update0.factId, docId, startTime: new Date() };
    } else if (prob0 && update0) {
        return { risky: false, prob: prob0, update: update0, docId: update0.docId };
    }
    return { risky: false, prob: prob0, update: update0 };
}



async function doneLearning(user, docId, fact) {
    docid2module.get(docId)
        .factToFactIds(fact)
        .forEach(factId => webSubmit(user, docId, factId, newlyLearned, { firstLearned: true }));
}

function webDoneQuizzing(docId: string, factId: string, allUpdates: FactUpdate[], info: any) {
    doneQuizzing(db, USER, docId, factId, allUpdates, info)
}

function main(sources) {
    const action$ = sources.DOM.select('.hit-me').events('click').mapTo(0) as xs<number>;

    const levelOpts = makeLeveldbOpts(USER);

    const quiz$ = action$.map(_ => xs.fromPromise(whatToQuiz(db, USER, '')))
        .flatten()
        .remember() as MemoryStream<WhatToQuizInfo>;
    // quiz$.addListener({ next: x => console.log('quiz', x) })

    function docIdModToKnownStream(docId, mod) {
        return quiz$
            .filter(q => q && !q.risky)
            .map(_ => xs.fromPromise(xstreamToPromise(getKnownFactIds(db, makeLeveldbOpts(USER, docId)))))
            .flatten()
            .remember();
    }

    const sinks = Array.from(docid2module.entries()).map(([docId, mod]) => {
        const all = isolate(mod.makeDOMStream)({
            DOM: sources.DOM,
            quiz: quiz$.filter(quiz => quiz && quiz.risky && quiz.docId === docId),
            known: docIdModToKnownStream(docId, mod)
        });
        all.learned.addListener({ next: fact => doneLearning(USER, docId, fact) });
        all.quizzed.addListener({ next: ([ans, quiz, info]) => webDoneQuizzing(quiz.update.docId, quiz.factId, quiz.allRelatedUpdates, info) })
        return all;
    });
    const allDom$ = xs.merge(...sinks.map(o => o.DOM));

    const vdom$ = allDom$.map(element => {
        return div([
            button('.hit-me', 'Hit me'),
            element
        ]);
    });
    return { DOM: vdom$ };
}

run(main, {
    DOM: makeDOMDriver('#app')
});
