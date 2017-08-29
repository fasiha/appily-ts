import bluebird = require('bluebird');

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import isolate from '@cycle/isolate';
import { run } from '@cycle/run';
import { div, ul, li, button, p, a, span, input, VNode, makeDOMDriver } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'
import { makeHTTPDriver } from '@cycle/http';

import { FactUpdate, FactDb, UserParams, DocParams, makeLeveldbOpts } from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import { WhatToLearnInfo, WhatToQuizInfo, FactDbCycle, CycleSinks, CycleSources } from "./cycleInterfaces";
import { SubmitToServer, MostForgottenToServer, KnownFactIdsToServer, KnownFactIdsFromServer, DoneQuizzingToServer } from "./restInterfaces";

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponymsCyclejs } from "./toponyms-cyclejs";
import { tono5kCyclejs } from "./tono5k-cyclejs";
import { scramblerCyclejs } from "./scrambler-cyclejs";
const docid2module: Map<string, FactDbCycle> = new Map([
    ["toponyms", toponymsCyclejs],
    ["tono5k", tono5kCyclejs],
    ["scrambler", scramblerCyclejs],
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

function paramsDOM(params: UserParams) {
    // let docsSources = new Map(params.doctypes.map(doctype => [doctype.name, doctype.sources.join(',')]));
    let docSources: Map<string, string> = new Map();
    for (const doc of params.docs) {
        docSources.set(doc.name, doc.source)
    }
    for (const key of Array.from(docid2module.keys())) {
        if (!docSources.has(key)) {
            docSources.set(key, '');
        }
    }
    return div([
        ul(Array.from(docSources.entries()).map(([docId, val]) => li([
            span(docId + ' '),
            input(`.appended .appended-${docId}`, { attrs: { type: 'text', value: val } })
        ]))),
        button('#params-save', 'Save')
    ]);
    // Save *SHOULD* update the stream so I don't have to refresh
}

function main(sources) {
    const docs$: xs<DocParams[]> = sources.DOM.select('button#params-save')
        .events('click')
        .map(_ => Array.from(document.querySelectorAll("input.appended")).map(
            (x: HTMLInputElement): DocParams => ({
                format: "tono5k",
                // FIXME!!!
                name: x.className.match(/appended-\S+/)[0].split('-').slice(1).join('-'),
                source: x.value.trim()
            })));
    // docs$.addListener({ next: x => console.log('doctypes', x) });

    // Login
    const getAuthStatus$ = xs.of(true).mapTo({ url: '/api/private', category: 'ping', method: 'GET' });
    const getUserParams$ = xs.of({ url: '/api/userParams', category: 'params', method: 'GET' });

    const userParams$: xs<UserParams> = sources.HTTP.select('params')
        .flatten()
        .map(res => res.body)
        .replaceError(e => xs.of(null))
        .remember();
    // userParams$.addListener({ next: x => console.log('userParams', x) });

    const updatedUserParams$ = xs.combine(userParams$, docs$).map(([userParams, docs]: [UserParams, DocParams[]]) => {
        const newParams: UserParams = { id: userParams.id, displayName: userParams.displayName, docs };
        return { url: 'api/userParams', category: 'writeParams', method: 'POST', send: newParams }
    })

    const authStatus$ = sources.HTTP.select('ping')
        .flatten()
        .map(o => !o.unauthorized)
        .replaceError(e => xs.of(false)) as xs<Boolean>;
    const authDom$ = xs.combine(authStatus$, userParams$).map(([loggedIn, params]) => {
        if (loggedIn) {
            return div([
                p('Logged in!'),
                paramsDOM(params),
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

    function docToKnownStream(docId) {
        return quiz$
            .filter(q => q && !q.risky)
            .map(_ => xs.fromPromise(getKnownFactIds(docId)))
            .flatten()
            .remember();
    }

    // const sinks = Array.from(docid2module.entries()).map(([docId, mod]) => {
    const sinks = userParams$.filter(x => !!x).map(params => {
        return params.docs.map(doc => {
            const docId = doc.name;
            const mod = docid2module.get(doc.format);

            const mysources: CycleSources = {
                DOM: sources.DOM,
                quiz: quiz$.filter(quiz => quiz && quiz.risky && quiz.docId === docId),
                known: docToKnownStream(docId),
                params: userParams$.filter(x => !!x).map(params => params.docs.find(doc => doc.name === docId)).filter(x => !!x)
            };

            const all: CycleSinks = isolate(mod.makeDOMStream)(mysources);
            all.learned.addListener({
                next: fact => {
                    const relateds = mod.factToFactIds(fact);
                    doneLearning(docId, relateds, relateds.map(_ => ({ firstLearned: true })));
                }
            });
            all.quizzed.addListener({
                next: ([ans, quiz, info]: [any, WhatToQuizInfo, any]) => {
                    const docId = quiz.update.docId;
                    const fact = quiz.howToQuiz.fact;
                    doneQuizzing(docId, quiz.update.factId, mod.factToFactIds(fact), [info]);
                }
            })
            return all;
        });
    });
    const allDom$ = sinks.map(o => xs.merge(...o.map(sink => sink.DOM))).flatten();
    // allDom$.addListener({ next: x => console.log('addDom', x) })

    const loginPlusAll$ = xs.combine(authDom$, allDom$);
    const vdom$ = loginPlusAll$.map(([login, element]) => {
        return div([
            login,
            element
        ]);
    });

    const httpRequests$ = xs.merge(getUserParams$, getAuthStatus$, updatedUserParams$);

    return {
        DOM: vdom$,
        HTTP: httpRequests$
    };
}

run(main, {
    DOM: makeDOMDriver('#app'),
    HTTP: makeHTTPDriver()
});
