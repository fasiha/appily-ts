import bluebird = require('bluebird');

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import isolate from '@cycle/isolate';
import { run } from '@cycle/run';
import { div, button, p, ol, li, span, input, form, makeDOMDriver, VNode } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'

import { FactUpdate, FactDb, makeLeveldbOpts } from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import { WhatToLearnInfo, WhatToQuizInfo, FactDbCycle } from "./cycleInterfaces";

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponymsCyclejs } from "./toponyms-cyclejs";
import { tono5kCyclejs } from "./tono5k-cyclejs";
import { scramblerCyclejs } from "./scrambler-cyclejs";
const docid2module: Map<string, FactDbCycle> = new Map([
    ["toponyms", toponymsCyclejs],
    ["tono5k", tono5kCyclejs],
    ["scrambler", scramblerCyclejs]
]);

const PROB_THRESH = 0.995;
const newlyLearned = ebisu.defaultModel(0.25, 2.5);

// Database

// Wrapper around all fact databases

import { SubmitToServer, MostForgottenToServer, KnownFactIdsToServer, KnownFactIdsFromServer, DoneQuizzingToServer } from "./RestInterfaces";

async function webSubmit(docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) {
    const submitting: SubmitToServer = { docId, factId, ebisuObject, updateObject };
    return fetch('/api/submit', {
        headers: {
            // 'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        method: "POST",
        body: JSON.stringify(submitting)
    });
}

async function getMostForgottenFact(soleDocId: string): Promise<WhatToQuizInfo> {
    const submitting: MostForgottenToServer = { soleDocId }
    const got = await (await fetch('/api/mostForgotten', {
        headers: { 'Content-Type': 'application/json' },
        method: "POST",
        body: submitting
    })).json();
    const update = got.update;
    const prob = got.prob;
    const docId = update && update.docId;
    return { update, prob, docId, risky: prob && prob <= PROB_THRESH && docid2module.has(update.docId), startTime: new Date() };
}


async function getKnownFactIds(docId: string): Promise<KnownFactIdsFromServer> {
    const submitting: KnownFactIdsToServer = { docId };
    return (await fetch('/api/knownFactIds', {
        headers: { 'Content-Type': 'application/json' },
        method: "POST",
        body: JSON.stringify(submitting)
    })).json();
}

async function doneLearning(docId: string, factIds: string[], updateObjects: any[]) {
    return Promise.all(factIds.map((factId, idx) => webSubmit(docId, factId, newlyLearned, updateObjects[idx])));
}

function doneQuizzing(docId: string, activelyQuizzedFactId: string, allQuizzedFactIds: string[], infos: any[]) {
    const submitting: DoneQuizzingToServer = { docId, activelyQuizzedFactId, allQuizzedFactIds, infos };
    return fetch('/api/doneQuizzing', {
        headers: { 'Content-Type': 'application/json' },
        method: "POST",
        body: JSON.stringify(submitting)
    });
}
function main(sources) {
    const action$ = sources.DOM.select('.hit-me').events('click').mapTo(0) as xs<number>;

    const SOLE_DOCID = '';
    const quiz$ = action$.map(_ => xs.fromPromise(getMostForgottenFact(SOLE_DOCID)))
        .flatten()
        .remember() as MemoryStream<WhatToQuizInfo>;
    // quiz$.addListener({ next: x => console.log('quiz', x) })

    function docIdModToKnownStream(docId, mod) {
        return quiz$
            .filter(q => q && !q.risky)
            .map(_ => xs.fromPromise(getKnownFactIds(docId)))
            .flatten()
            .remember();
    }

    const sinks = Array.from(docid2module.entries()).map(([docId, mod]) => {
        const all = isolate(mod.makeDOMStream)({
            DOM: sources.DOM,
            quiz: quiz$.filter(quiz => quiz && quiz.risky && quiz.docId === docId),
            known: docIdModToKnownStream(docId, mod)
        });
        all.learned.addListener({
            next: fact => {
                const relateds = docid2module.get(docId).factToFactIds(fact);
                doneLearning(docId, relateds, relateds.map(_ => ({ firstLearned: true })));
            }
        });
        all.quizzed.addListener({
            next: ([ans, quiz, info]) => {
                const docId = quiz.update.docId;
                const fact = quiz.quizInfo.fact;
                doneQuizzing(docId, quiz.factId, docid2module.get(docId).factToFactIds(fact), [info]);
            }
        })
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
