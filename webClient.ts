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
    FactUpdate, collectKefirStream, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, FactDb
} from "./storageServer";
import { EbisuObject } from "./ebisu";
import { FactDbCli } from "./cliInterface";

let USER = "ammy";

// Import all FactDb-implementing modules, then add them to the docid2module map!
import { toponyms } from "./toponyms";
import { tono5k } from "./tono5k";
let docid2module: Map<string, FactDb> = new Map([["toponyms", toponyms], ["tono5k", tono5k]]);

async function webSubmit(user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) {
    return submit(db, user, docId, factId, ebisuObject, updateObject);
}

// async function loop(SOLE_DOCID: string = '', probThreshold: number = 0.5) {
//     const levelOpts = makeLeveldbOpts(USER, SOLE_DOCID);

//     let [update0, prob0]: [FactUpdate, number] = await getMostForgottenFact(db, levelOpts).toPromise();
//     if (prob0 && prob0 <= probThreshold) {
//         const docId = update0.docId;
//         const factdb = docid2module.get(docId);
//         const plain0 = factdb.stripFactIdOfSubfact(update0.factId);
//         const allRelatedUpdates = await collectKefirStream(omitNonlatestUpdates(db, makeLeveldbOpts(USER, docId, plain0, true)));

//         console.log("Review!", prob0);
//         const quizInfo = await factdb.howToQuiz(USER, docId, update0.factId, allRelatedUpdates);
//     } else {
//         if (SOLE_DOCID) {
//             const factdb = docid2module.get(SOLE_DOCID);
//             await factdb.findAndLearn(USER, SOLE_DOCID, await collectKefirStream(getKnownFactIds(db, makeLeveldbOpts(USER, SOLE_DOCID))));
//         } else {
//             // FIXME why Array.from required here? TypeScript problem?
//             for (const [docId, factdb] of Array.from(docid2module.entries())) {
//                 await factdb.findAndLearn(USER, docId, await collectKefirStream(getKnownFactIds(db, makeLeveldbOpts(USER, docId))));
//             }
//         }
//     }
// }
// loop();

async function webprompt(): Promise<string> {
    return new Promise((resolve, reject) => {
        (document.querySelector('button#accept-button') as HTMLElement).onclick = e => {
            resolve((document.querySelector('#prompt') as HTMLInputElement).value);
        };
    }) as Promise<string>;
}

interface HowToQuizInfo {
    prob: number;
    update: FactUpdate;
    quizInfo?: any;
    allRelatedUpdates?: FactUpdate[];
    factId?: string;
    startTime?: Date;
};
const PROB_THRESH = 0.995;
async function howToQuiz(db, USER, SOLE_DOCID): Promise<HowToQuizInfo> {
    let [update0, prob0]: [FactUpdate, number] = await getMostForgottenFact(db, makeLeveldbOpts(USER, SOLE_DOCID)).toPromise();
    if (prob0 && prob0 <= PROB_THRESH) {
        const docId = update0.docId;
        const factdb = docid2module.get(docId);
        const plain0 = factdb.stripFactIdOfSubfact(update0.factId);
        const allRelatedUpdates = await collectKefirStream(omitNonlatestUpdates(db, makeLeveldbOpts(USER, docId, plain0, true)));
        const quizInfo = await factdb.howToQuiz(USER, docId, update0.factId, allRelatedUpdates);
        return { prob: prob0, quizInfo, update: update0, allRelatedUpdates, factId: update0.factId, startTime: new Date() };
    }
    return { prob: prob0, update: update0 };
}

type SomeFact = any;
async function whatToLearn(db, USER: string, DOCID: string): Promise<SomeFact> {
    const knownFactIds: string[] = await collectKefirStream(getKnownFactIds(db, makeLeveldbOpts(USER, DOCID)));
    const fact = tono5k.whatToLearn(USER, DOCID, knownFactIds);
    return fact;
}

import { endsWith, elapsedHours } from "./utils";

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
    }
    return div([p("QUIZ TIME!!!")].concat(vec));
}

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import { run } from '@cycle/run';
import { div, button, p, ol, li, span, makeDOMDriver, VNode } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'

function main(sources) {
    const action$ = sources.DOM.select('.hit-me').events('click').mapTo(0) as xs<number>;

    const levelOpts = makeLeveldbOpts(USER);

    const quiz$ = action$.map(_ => xs.fromPromise(howToQuiz(db, USER, '')))
        .flatten()
        .startWith(null) as MemoryStream<HowToQuizInfo>;

    const answerButton$ = sources.DOM.select('.answer').events('click').map(e => +(e.target.id.split('-')[1])) as xs<number>;
    const questionAnswer$ = answerButton$.compose(sampleCombine(quiz$));

    const fact$ = quiz$
        .filter(q => q && q.prob > PROB_THRESH)
        .map(_ => xs.fromPromise(whatToLearn(db, USER, '')))
        .flatten().
        startWith(null) as MemoryStream<SomeFact>;

    const all$ = xs.merge(quiz$, fact$, questionAnswer$);
    const vdom$ = all$.map(element => {
        let custom;
        if (element && element.prob !== undefined) {
            // is HowToQuiz
            custom = quizToDOM(element as HowToQuizInfo)
        } else if (element && element[1] && element[1].prob !== undefined) {
            // is answer button
            custom = p(JSON.stringify(element));
        } else if (element) {
            // is fact
            custom = p(JSON.stringify(element));
        }
        return div([
            button('.hit-me', 'Hit me'),
            custom,
            p('hi')
        ]);
    });
    return { DOM: vdom$ };
}

run(main, {
    DOM: makeDOMDriver('#app')
});
