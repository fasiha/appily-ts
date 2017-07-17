import bluebird = require('bluebird');

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import { run } from '@cycle/run';
import { div, button, p, ol, li, span, input, form, makeDOMDriver, VNode } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'

import {
    FactUpdate, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, doneQuizzing, FactDb
} from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import { WhatToLearnInfo, HowToQuizInfo, FactDbCycle } from "./cycleInterfaces";

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponyms } from "./toponyms";
import { tono5kCyclejs } from "./tono5k-cyclejs";
const docid2module: Map<string, FactDbCycle> = new Map([/*["toponyms", toponyms],*/["tono5k", tono5kCyclejs]]);

const USER = "ammy";
const PROB_THRESH = 0.5;
const newlyLearned = ebisu.defaultModel(0.25, 2.5);

// Database

type Db = any;

const shoe = require('shoe');
const multilevel = require('multilevel');
const db: Db = multilevel.client();

bluebird.promisifyAll(db);

const stream = shoe('/api/ml', function() {
    console.log("Connected.");
});
stream.pipe(db.createRpcStream()).pipe(stream);

// Wrapper around all fact databases

async function webSubmit(user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) {
    return submit(db, user, docId, factId, ebisuObject, updateObject);
}


async function whatToQuiz(db, USER, SOLE_DOCID): Promise<HowToQuizInfo> {
    let [update0, prob0]: [FactUpdate, number] = (await xstreamToPromise(getMostForgottenFact(db, makeLeveldbOpts(USER, SOLE_DOCID))))[0];

    if (prob0 && prob0 <= PROB_THRESH) {
        const docId = update0.docId;
        const factdb = docid2module.get(docId);
        const plain0 = factdb.stripFactIdOfSubfact(update0.factId);
        const allRelatedUpdates = await xstreamToPromise(omitNonlatestUpdates(db, makeLeveldbOpts(USER, docId, plain0, true)));
        const quizInfo = await factdb.howToQuiz(USER, docId, update0.factId, allRelatedUpdates);
        return { risky: true, prob: prob0, quizInfo, update: update0, allRelatedUpdates, factId: update0.factId, startTime: new Date() };
    }
    return { risky: false, prob: prob0, update: update0 };
}


async function whatToLearn(db, USER: string, SOLE_DOCID: string): Promise<WhatToLearnInfo> {
    const knownFactIds: string[] = await xstreamToPromise(getKnownFactIds(db, makeLeveldbOpts(USER, SOLE_DOCID)));
    let factsPromises: Promise<WhatToLearnInfo>[] = [];
    for (const [docId, mod] of Array.from(docid2module)) {
        factsPromises.push(mod.whatToLearn(USER, docId, knownFactIds).then(fact => ({ fact, docId: docId })));
    }
    const facts = (await Promise.all(factsPromises)).filter(x => !!x);
    return facts.length ? facts[0] : null;
}

async function doneLearning(USER, DOCID, fact) {
    docid2module.get(DOCID).factToFactIds(fact).forEach(factId => webSubmit(USER, DOCID, factId, newlyLearned, { firstLearned: true }));
}

function main(sources) {
    const action$ = sources.DOM.select('.hit-me').events('click').mapTo(0) as xs<number>;

    const levelOpts = makeLeveldbOpts(USER);

    const quiz$ = action$.map(_ => xs.fromPromise(whatToQuiz(db, USER, '')))
        .flatten()
        .startWith(null) as MemoryStream<HowToQuizInfo>;
    const quizDom$ = quiz$.map(quiz => quiz && quiz.risky ? docid2module.get(quiz.update.docId).quizToDOM(quiz) : null);

    const answerButton$ = xs.merge(sources.DOM.select('form').events('submit').map(e => {
        e.preventDefault();
        return (document.querySelector('#answer-text') as any).value
    }),
        sources.DOM.select('button.answer').events('click').map(e => +(e.target.id.split('-')[1]))) as xs<number | string>;
    const questionAnswer$ = answerButton$.compose(sampleCombine(quiz$));
    const questionAnswerDom$ = questionAnswer$.map(([ans, quiz]) => docid2module.get(quiz.update.docId).checkAnswer(db, USER, [ans, quiz]));

    const fact$ = quiz$
        .filter(q => q && !q.risky)
        .map(_ => xs.fromPromise(whatToLearn(db, USER, '')))
        .flatten().
        startWith(null) as MemoryStream<WhatToLearnInfo>;
    const factDom$ = fact$.map(fact => fact ? docid2module.get(fact.docId).newFactToDom(fact) : null);
    const learnedFact$ = sources.DOM.select('button#learned-button').events('click').compose(sampleCombine(fact$)).map(([_, fact]) => fact) as xs<WhatToLearnInfo>;
    learnedFact$.addListener({ next: fact => doneLearning(USER, fact.docId, fact.fact) });

    const learnedFactDom$ = learnedFact$.map(fact => p("Great!"));

    const all$ = xs.merge(quizDom$, factDom$, questionAnswerDom$, learnedFactDom$);
    const vdom$ = all$.map(element => {
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
