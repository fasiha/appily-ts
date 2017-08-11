import bluebird = require('bluebird');

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import isolate from '@cycle/isolate';
import { run } from '@cycle/run';
import { div, ul, li, button, p, a, span, input, VNode, makeDOMDriver } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'
import { makeHTTPDriver } from '@cycle/http';

import { FactUpdate, FactDb, UserParams, makeLeveldbOpts } from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import { WhatToLearnInfo, WhatToQuizInfo, FactDbCycle, CycleSinks, CycleSources } from "./cycleInterfaces";
import { SubmitToServer, MostForgottenToServer, KnownFactIdsToServer, KnownFactIdsFromServer, DoneQuizzingToServer } from "./restInterfaces";

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponymsCyclejs } from "./toponyms-cyclejs";
import { tono5kCyclejs } from "./tono5k-cyclejs";
import { scramblerCyclejs } from "./scrambler-cyclejs";
const docid2module: Map<string, FactDbCycle> = new Map([
    // ["toponyms", toponymsCyclejs],
    ["tono5k", tono5kCyclejs],
    // ["scrambler", scramblerCyclejs],
]);

const PROB_THRESH = 0.25;
const newlyLearned = ebisu.defaultModel(0.25, 2.5);


const TONO_URL = "https://raw.githubusercontent.com/fasiha/tono-yamazaki-maekawa/master/tono.json";


// Database

// Wrapper around all fact databases

function postObject(obj) {
    return {
        headers: { 'Content-Type': 'application/json' },
        method: "POST",
        body: JSON.stringify(obj),
        credentials: 'include'
    } as RequestInit;
}

async function webSubmit(docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) {
    const submitting: SubmitToServer = { docId, factId, ebisuObject, updateObject };
    return fetch('/api/submit', postObject(submitting));
}

async function getMostForgottenFact(soleDocId: string): Promise<WhatToQuizInfo> {
    const submitting: MostForgottenToServer = { soleDocId }
    const got = await (await fetch('/api/mostForgotten', postObject(submitting))).json();
    const update = got.update;
    const prob = got.prob;
    const docId = update && update.docId;
    return { update, prob, docId, risky: prob && prob <= PROB_THRESH && docid2module.has(update.docId), startTime: new Date() };
}

async function getKnownFactIds(docId: string): Promise<KnownFactIdsFromServer> {
    const submitting: KnownFactIdsToServer = { docId };
    return (await fetch('/api/knownFactIds', postObject(submitting))).json();
}

async function doneLearning(docId: string, factIds: string[], updateObjects: any[]) {
    return Promise.all(factIds.map((factId, idx) => webSubmit(docId, factId, newlyLearned, updateObjects[idx])));
}

function doneQuizzing(docId: string, activelyQuizzedFactId: string, allQuizzedFactIds: string[], infos: any[]) {
    const submitting: DoneQuizzingToServer = { docId, activelyQuizzedFactId, allQuizzedFactIds, infos };
    return fetch('/api/doneQuizzing', postObject(submitting));
}

function paramsDOM() {
    return div([
        ul(Array.from(docid2module.keys()).map(docId => li([
            span(docId),
            input(`.appended .appended-${docId}`, { type: 'text' })
        ]))),
        button('#params-save', 'Save')
    ]);
}

function main(sources) {
    const paramsStrings$ = sources.DOM.select('button#params-save')
        .events('click')
        .map(_ => Array.from(document.querySelectorAll("input.appended")).map((x: HTMLInputElement) => x.value));
    paramsStrings$.addListener({ next: x => console.log('paramsStrings', x) });

    // Login
    const getAuthStatus$ = xs.of(true).mapTo({ url: '/api/private', category: 'ping', method: 'GET' });
    const getUserParams$ = xs.of({ url: '/api/userParams', category: 'params', method: 'GET' });
    const httpRequests$ = xs.merge(getUserParams$, getAuthStatus$);

    const userParams$: xs<UserParams> = sources.HTTP.select('params')
        .flatten()
        .map(res => res.body)
        .replaceError(e => xs.of(null));

    const authStatus$ = sources.HTTP.select('ping')
        .flatten()
        .map(o => !o.unauthorized)
        .replaceError(e => xs.of(false)) as xs<Boolean>;
    const authDom$ = authStatus$.map(loggedIn => {
        if (loggedIn) {
            return div([
                p('Logged in!'),
                paramsDOM(),
                button('.hit-me', 'Hit me')
            ])
        } else {
            return a({ attrs: { href: "/auth/github" } }, 'Log in with GitHub!')
        }
    }).remember();

    // SRS
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
        const mysources: CycleSources = {
            DOM: sources.DOM,
            quiz: quiz$.filter(quiz => quiz && quiz.risky && quiz.docId === docId),
            known: docIdModToKnownStream(docId, mod),
            params: userParams$.map(params => params.doctypes.find(doctype => doctype.name === docId))
        };
        const all = isolate(mod.makeDOMStream)(mysources);
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

    const loginPlusAll$ = xs.combine(authDom$, allDom$);
    const vdom$ = loginPlusAll$.map(([login, element]) => {
        return div([
            login,
            element
        ]);
    });

    return {
        DOM: vdom$,
        HTTP: httpRequests$
    };
}

run(main, {
    DOM: makeDOMDriver('#app'),
    HTTP: makeHTTPDriver()
});
