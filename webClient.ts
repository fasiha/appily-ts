import bluebird = require('bluebird');

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import isolate from '@cycle/isolate';
import { run } from '@cycle/run';
import { div, button, p, a, span, input, VNode, makeDOMDriver } from '@cycle/dom';
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


function LabeledSlider(sources) {
    const domSource = sources.DOM;
    const props$ = sources.props;

    const newValue$ = domSource
        .select('.slider')
        .events('input')
        .map(ev => ev.target.value);

    const state$ = props$
        .map(props => newValue$
            .map(val => ({
                label: props.label,
                unit: props.unit,
                min: props.min,
                value: val,
                max: props.max
            }))
            .startWith(props)
        )
        .flatten()
        .remember();

    const vdom$ = state$
        .map(state =>
            div('.labeled-slider', [
                span('.label',
                    state.label + ' ' + state.value + state.unit
                ),
                input('.slider', {
                    attrs: { type: 'range', min: state.min, max: state.max, value: state.value }
                })
            ])
        );

    const sinks = {
        DOM: vdom$,
        value: state$.map(state => state.value),
    };
    return sinks;
}


// function docsToDom(): VNode {
//     // return div(Array.from(docid2module.keys()).map((docid: string) => ));
// }

function main(sources) {
    // Testing
    const strs$ = sources.DOM.select('button#appender')
        .events('click')
        .mapTo(_ => Array.from(document.querySelectorAll("input.appended")).map((x: HTMLInputElement) => x.value))
        .startWith(["torpor", "torpid", "torpedo"])

    const strsDom$ = strs$.map((vec: string[]) => {
        div(vec.map(s => input('.appended', { type: "text", text: s })).concat([button("#saver", "Save"), button("#appender", "+")]));
    });

    const saver$ = sources.DOM.select('button#saver').events('click');
    saver$.addListener({ next: x => console.log('juicy!', x) });

    // Login
    const getAuthStatus$ = xs.of(true).mapTo({ url: '/api/private', category: 'ping', method: 'GET' });
    const authStatus$: xs<any> = sources.HTTP.select('ping')
        .flatten()
        .map(o => !o.unauthorized)
        .replaceError(e => xs.of(false)) as xs<Boolean>;
    const authDom$ = authStatus$.map(loggedIn => {
        if (loggedIn) {
            return div([
                p('Logged in!'),

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
        DOM: vdom$,
        HTTP: getAuthStatus$
    };
}

run(main, {
    DOM: makeDOMDriver('#app'),
    HTTP: makeHTTPDriver()
});
