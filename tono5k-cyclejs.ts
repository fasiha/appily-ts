import { tono5k, Tono } from "./tono5k";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import {
    FactUpdate, getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, doneQuizzing, FactDb
} from "./storageServer";
import { WhatToQuizInfo, FactDbCycle, WhatToLearnInfo, CycleSinks, CycleSources } from "./cycleInterfaces";

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import { run } from '@cycle/run';
import { div, button, p, ol, li, span, input, form, makeDOMDriver, VNode } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'


const whatToLearn = tono5k.whatToLearn;
const howToQuiz = tono5k.howToQuiz;
const stripFactIdOfSubfact = tono5k.stripFactIdOfSubfact;

export const tono5kCyclejs: FactDbCycle = { makeDOMStream, stripFactIdOfSubfact, factToFactIds: tono5k.factToFactIds };

function quizToDOM(quiz: WhatToQuizInfo): VNode {
    const factId = quiz.factId;
    // const quizInfo = await tono5k.howToQuiz(factId);
    const quizInfo = quiz.quizInfo;
    const fact = quizInfo.fact;
    let vec = [];
    if (endsWith(factId, '-kanji') || endsWith(factId, '-meaning')) {
        if (endsWith(factId, '-kanji')) {
            let s = `What’s the kanji for: ${fact.readings.join('・')} and meaning 「${fact.meaning}」?`;
            vec.push(p(s));
            vec.push(ol(quizInfo.confusers.map((fact, idx) => li([button(`#answer-${idx}.answer`, `${idx + 1}`), span(` ${fact.kanjis.join('・')}`)]))));
        } else {
            let s = `What’s the meaning of: ${fact.kanjis.length ? fact.kanjis.join('・') + ', ' : ''}${fact.readings.join('・')}?`;
            vec.push(p(s));
            vec.push(ol(quizInfo.confusers.map((fact, idx) => li([button(`#answer-${idx}.answer`, `${idx + 1}`), span(` ${fact.meaning}`)]))));
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



function checkAnswer([answer, quiz]: [number | string, WhatToQuizInfo]) {
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
    return { DOM: p(result ? '✅✅✅!' : '❌❌❌'), sink: [answer, quiz, info] };
}


function newFactToDom(fact: WhatToLearnInfo): VNode {
    if (!fact) { return null; }
    return div([p("Hey! Learn this: " + JSON.stringify(fact.fact)),
    button("#learned-button", "Learned!")]);
}

function makeDOMStream(sources: CycleSources): CycleSinks {
    const quiz$ = sources.quiz
        .map((quiz: WhatToQuizInfo) => xs.fromPromise(tono5k.howToQuiz(quiz.factId).then(quizInfo => {
            quiz.quizInfo = quizInfo;
            return quiz;
        })))
        .flatten().remember() as MemoryStream<WhatToQuizInfo>;
    const known$ = sources.known;
    // quiz$.addListener({ next: x => console.log('quiz3', x) })

    const quizDom$ = quiz$.map(quiz => quiz && quiz.risky ? quizToDOM(quiz) : null);
    const answerButton$ = xs.merge(sources.DOM.select('form').events('submit').map(e => {
        e.preventDefault();
        return (document.querySelector('#answer-text') as any).value
    }),
        sources.DOM.select('button.answer').events('click').map(e => +(e.target.id.split('-')[1]))) as xs<number | string>;
    const questionAnswer$ = answerButton$.compose(sampleCombine(quiz$));
    const questionAnswerResult$ = questionAnswer$/*.filter(([ans, quiz] )=> !!quiz)*/.map(([ans, quiz]) => checkAnswer([ans, quiz]));
    const questionAnswerSink$ = questionAnswerResult$.map(o => o.sink);
    const questionAnswerDom$ = questionAnswerResult$.map(o => o.DOM);
    const quizAllDom$ = xs.merge(questionAnswerDom$, quizDom$);

    const fact$ = known$.map(knownFactIds => xs.fromPromise(tono5k.whatToLearn(knownFactIds))).flatten().remember();
    const factDom$ = fact$.map(fact => fact ? newFactToDom(fact) : null);
    const learnedFact$ = sources.DOM.select('button#learned-button').events('click').compose(sampleCombine(fact$)).map(([_, fact]) => fact) as xs<WhatToLearnInfo>;
    const learnedFactDom$ = learnedFact$.map(fact => p("Great!"));
    const learnAllDom$ = xs.merge(factDom$, learnedFactDom$).startWith(null);

    return {
        DOM: xs.merge(quizAllDom$, learnAllDom$),
        learned: learnedFact$,
        quizzed: questionAnswerSink$
    };
}