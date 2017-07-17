import { tono5k, Tono, factToFactIds } from "./tono5k";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import {
    FactUpdate, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, doneQuizzing, FactDb
} from "./storageServer";
import { HowToQuizInfo, FactDbCycle, WhatToLearnInfo } from "./cycleInterfaces";

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import { run } from '@cycle/run';
import { div, button, p, ol, li, span, input, form, makeDOMDriver, VNode } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'


const whatToLearn = tono5k.whatToLearn;
const howToQuiz = tono5k.howToQuiz;
const stripFactIdOfSubfact = tono5k.stripFactIdOfSubfact;

export const tono5kCyclejs: FactDbCycle = { howToQuiz, checkAnswer, quizToDOM, whatToLearn, stripFactIdOfSubfact, newFactToDom, factToFactIds };

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



function checkAnswer(db, USER: string, [answer, quiz]: [number | string, HowToQuizInfo]): VNode {
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

function newFactToDom(fact: WhatToLearnInfo): VNode {
    if (!fact) { return null; }
    return div([p("Hey! Learn this: " + JSON.stringify(fact.fact)),
    button("#learned-button", "Learned!")]);
}
