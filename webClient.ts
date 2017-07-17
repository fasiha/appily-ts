type Db = any;

const shoe = require('shoe');
const multilevel = require('multilevel');
const db: Db = multilevel.client();

import bluebird = require('bluebird');
bluebird.promisifyAll(db);

const stream = shoe('/api/ml', function() {
    console.log("Connected.");
});
stream.pipe(db.createRpcStream()).pipe(stream);

import {
    FactUpdate, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, doneQuizzing, FactDb
} from "./storageServer";
import { EbisuObject } from "./ebisu";
// import { FactDbCli } from "./cliInterface";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";

let USER = "ammy";

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponyms } from "./toponyms";
import { tono5k } from "./tono5k";
let docid2module: Map<string, FactDb> = new Map([["toponyms", toponyms], ["tono5k", tono5k]]);

async function webSubmit(user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) {
    return submit(db, user, docId, factId, ebisuObject, updateObject);
}

interface HowToQuizInfo {
    prob: number;
    update: FactUpdate;
    risky: boolean;
    quizInfo?: any;
    allRelatedUpdates?: FactUpdate[];
    factId?: string;
    startTime?: Date;
};
const PROB_THRESH = 0.25;
async function howToQuiz(db, USER, SOLE_DOCID): Promise<HowToQuizInfo> {
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

type SomeFact = any;
async function whatToLearn(db, USER: string, DOCID: string): Promise<SomeFact> {
    const knownFactIds: string[] = await xstreamToPromise(getKnownFactIds(db, makeLeveldbOpts(USER, DOCID)));
    const fact = tono5k.whatToLearn(USER, DOCID, knownFactIds);
    return fact;
}

function checkAnswer([answer, quiz]: [number | string, HowToQuizInfo]) {
    let result;
    let info: any = { hoursWaited: elapsedHours(quiz.startTime) };
    if (typeof answer === 'string') {
        result = quiz.quizInfo.fact.readings.indexOf(answer) >= 0;
        info.result = result;
        info.response = answer;
    } else {
        result = quiz.quizInfo.confusers[answer].num === quiz.quizInfo.fact.num
        info.result = result;
        info.response = quiz.quizInfo.confusers[answer].num;
        info.confusers = quiz.quizInfo.confusers.map(fact => fact.num);
    };
    console.log('COMMITTING!', info);
    doneQuizzing(db, USER, quiz.update.docId, quiz.factId, quiz.allRelatedUpdates, info);
    return p(result ? '✅✅✅!' : '❌❌❌');
}

function quizToDOM(quiz: HowToQuizInfo): VNode {
    const factId = quiz.factId;
    const fact = quiz.quizInfo.fact;
    let vec = [];
    if (endsWith(factId, '-kanji') || endsWith(factId, '-meaning')) {
        if (endsWith(factId, '-kanji')) {
            let s = `What’s the kanji for: ${fact.readings.join('・')} and meaning 「${fact.meaning}」?`;
            vec.push(p(s));
            vec.push(ol(quiz.quizInfo.confusers.map((fact, idx) => li([button(`#answer-${idx}.answer`, `${idx + 1}`), span(` ${fact.kanjis.join('・')}`)]))));
        } else {
            let s = `What’s the meaning of: ${fact.kanjis.length ? fact.kanjis.join('・') + ', ' : ''}${fact.readings.join('・')}?`;
            vec.push(p(s));
            vec.push(ol(quiz.quizInfo.confusers.map((fact, idx) => li([button(`#answer-${idx}.answer`, `${idx + 1}`), span(` ${fact.meaning}`)]))));
        }
    } else {
        if (fact.kanjis.length) {
            vec.push(p(`What’s the reading for: ${fact.kanjis.join('・')}, 「${fact.meaning}」?`));
        } else {
            vec.push(p(`What’s the reading for: 「${fact.meaning}」?`));
        }
        vec.push(form('.answer-form', { attrs: { autocomplete: "off", action: 'javascript:void(0);' } },
            [input('#answer-text', { type: "text", placeholder: "Doo bee doo bee doo" }),
            button('#answer-submit', 'Submit')]));
    }
    return div([p("QUIZ TIME!!!")].concat(vec));
}

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import { run } from '@cycle/run';
import { div, button, p, ol, li, span, input, form, makeDOMDriver, VNode } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'

function main(sources) {
    const action$ = sources.DOM.select('.hit-me').events('click').mapTo(0) as xs<number>;

    const levelOpts = makeLeveldbOpts(USER);

    const quiz$ = action$.map(_ => xs.fromPromise(howToQuiz(db, USER, '')))
        .flatten()
        .startWith(null) as MemoryStream<HowToQuizInfo>;
    const quizDom$ = quiz$.map(quiz => quiz && quiz.risky ? quizToDOM(quiz) : null);

    const answerButton$ = xs.merge(sources.DOM.select('form').events('submit').map(e => {
        e.preventDefault();
        return (document.querySelector('#answer-text') as any).value
    }),
        sources.DOM.select('button.answer').events('click').map(e => +(e.target.id.split('-')[1]))) as xs<number | string>;
    const questionAnswer$ = answerButton$.compose(sampleCombine(quiz$));
    const questionAnswerDom$ = questionAnswer$.map(checkAnswer);

    const fact$ = quiz$
        .filter(q => q && !q.risky)
        .map(_ => xs.fromPromise(whatToLearn(db, USER, '')))
        .flatten().
        startWith(null) as MemoryStream<SomeFact>;
    const factDom$ = fact$.map(fact => fact ? p(JSON.stringify(fact)) : null);

    const all$ = xs.merge(quizDom$, factDom$, questionAnswerDom$);
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
