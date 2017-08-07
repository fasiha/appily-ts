import bluebird = require('bluebird');

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import isolate from '@cycle/isolate';
import { run } from '@cycle/run';
import { div, ul, li, button, p, a, input, makeDOMDriver } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'
import { makeHTTPDriver } from '@cycle/http';

import { FactUpdate, FactDb, makeLeveldbOpts } from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import { WhatToLearnInfo, WhatToQuizInfo, FactDbCycle } from "./cycleInterfaces";
import { SubmitToServer, MostForgottenToServer, KnownFactIdsToServer, KnownFactIdsFromServer, DoneQuizzingToServer } from "./restInterfaces";

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponymsCyclejs } from "./toponyms-cyclejs";
import { tono5kCyclejs } from "./tono5k-cyclejs";
import { scramblerCyclejs } from "./scrambler-cyclejs";
const docid2module: Map<string, FactDbCycle> = new Map([
    ["toponyms", toponymsCyclejs],
    ["tono5k", tono5kCyclejs],
    ["scrambler", scramblerCyclejs]
]);

const PROB_THRESH = 0.25;
const newlyLearned = ebisu.defaultModel(0.25, 2.5);

// Database

// Wrapper around all fact databases

async function webSubmit(docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) {
    const submitting: SubmitToServer = { docId, factId, ebisuObject, updateObject };
    return fetch('/api/submit', {
        headers: { 'Content-Type': 'application/json' },
        method: "POST",
        body: JSON.stringify(submitting),
        credentials: 'include'
    });
}

async function getMostForgottenFact(soleDocId: string): Promise<WhatToQuizInfo> {
    const submitting: MostForgottenToServer = { soleDocId }
    const got = await (await fetch('/api/mostForgotten', {
        headers: { 'Content-Type': 'application/json' },
        method: "POST",
        body: JSON.stringify(submitting),
        credentials: 'include'
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
        body: JSON.stringify(submitting),
        credentials: 'include'
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
        body: JSON.stringify(submitting),
        credentials: 'include'
    });
}

function main(sources) {

    // Testing
    const getAppendedStrings = () => Array.from(document.querySelectorAll("input.appended")).map((x: HTMLInputElement) => x.value);

    const deletes$ = sources.DOM.select('button.deleter').events('click').map(e => e.target.id) as xs<string>;
    const strs$ = xs.merge(
        deletes$,
        sources.DOM.select('button#appender')
            .events('click')
            .mapTo(''))
        .map((id: string) => {
            let allStrings = getAppendedStrings();
            if (id === '') {
                return allStrings.concat('');
            }
            const deleteIdx = +(id.split('-')[1]);
            allStrings.splice(deleteIdx, 1);
            return allStrings;
        })
        .startWith(["torpor", "torpid", "torpedo"]) as MemoryStream<string[]>;

    const strsDom$ = strs$.map(vec => {
        return div('#juicy',
            [
                p("TITLE" + ':'),
                ul(vec.map((s, idx) => li(
                    [
                        input('.appended', { attrs: { type: "text", value: s } }),
                        button(`#deleter-${idx}.deleter`, 'Delete')
                    ]))
                    .concat([button("#saver", "Save"), button("#appender", "+")]))]);
    });
    const saveds$ = sources.DOM.select('button#saver').events('click').map(_ => getAppendedStrings());

    saveds$.addListener({ next: x => console.log('juicy!', x) });


    // Login
    const getAuthStatus$ = xs.of(true).mapTo({ url: '/api/private', category: 'ping', method: 'GET' });
    const authStatus$: xs<any> = sources.HTTP.select('ping')
        .flatten()
        .map(o => !o.unauthorized)
        .replaceError(e => xs.of(false)) as xs<Boolean>;
    const authDom$ = authStatus$.map(loggedIn => {
        if (loggedIn) {
            return div([p('Logged in!'), button('.hit-me', 'Hit me')])
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

    const loginPlusAll$ = xs.combine(authDom$, allDom$);
    const vdom$ = loginPlusAll$.map(([login, element]) => {
        return div([
            login,
            element
        ]);
    });

    return {
        DOM: strsDom$,
        HTTP: getAuthStatus$
    };
}

run(main, {
    DOM: makeDOMDriver('#app'),
    HTTP: makeHTTPDriver()
});
