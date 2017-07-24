import { Tono, HowToQuizInfo, tono5k } from "./tono5k";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import { WhatToQuizInfo, FactDbCycle, WhatToLearnInfo, CycleSinks, CycleSources } from "./cycleInterfaces";

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import { run } from '@cycle/run';
import { div, button, p, ol, li, span, input, form, makeDOMDriver, VNode } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'

export const tono5kCyclejs: FactDbCycle = {
    makeDOMStream,
    stripFactIdOfSubfact: tono5k.stripFactIdOfSubfact,
    factToFactIds: tono5k.factToFactIds
};

function quizToDOM(quiz: WhatToQuizInfo): VNode {
    const factId = quiz.update.factId;
    const quizInfo = quiz.quizInfo;
    const fact: Tono = quizInfo.fact;
    let vec = [];
    if (endsWith(factId, '-kanji') || endsWith(factId, '-meaning')) {
        const confusers: Tono[] = quizInfo.confusers;
        if (endsWith(factId, '-kanji')) {
            let s = `What’s the kanji for: ${fact.readings.join('・')} and meaning 「${fact.meaning}」?`;
            vec.push(p(s));
            vec.push(ol(confusers.map((fact, idx) => li([button(`#answer-${idx}.answer`, `${idx + 1}`), span(` ${fact.kanjis.join('・')}`)]))));
        } else {
            let s = `What’s the meaning of: ${fact.kanjis.length ? fact.kanjis.join('・') + ', ' : ''}${fact.readings.join('・')}?`;
            vec.push(p(s));
            vec.push(ol(confusers.map((fact, idx) => li([button(`#answer-${idx}.answer`, `${idx + 1}`), span(` ${fact.meaning}`)]))));
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
    return div([p(`¡¡¡QUIZ TIME!!! ${quiz.prob.toFixed(5)}`)].concat(vec));
}



function checkAnswer([answer, quiz]: [number | string, WhatToQuizInfo]) {
    let result: boolean;
    let info: any = { hoursWaited: elapsedHours(quiz.startTime) };
    const quizInfo: HowToQuizInfo = quiz.quizInfo;
    if (typeof answer === 'string') {
        result = quizInfo.fact.readings.indexOf(answer) >= 0;
        info.result = result;
        info.response = answer;
    } else {
        result = quizInfo.confusers[answer].num === quizInfo.fact.num
        info.result = result;
        info.response = quizInfo.confusers[answer].num;
        info.confusers = quizInfo.confusers.map(fact => fact.num);
    };
    // console.log('COMMITTING!', info);
    return { DOM: p(result ? '✅✅✅!' : '❌❌❌'), sink: [answer, quiz, info] };
}


function newFactToDom(fact: WhatToLearnInfo): VNode {
    if (!fact) { return null; }
    return div([p("Hey! Learn this: " + JSON.stringify(fact.fact)),
    button("#learned-button", "Learned!")]);
}

function makeDOMStream(sources: CycleSources): CycleSinks {
    const quiz$ = sources.quiz
        .map((quiz: WhatToQuizInfo) => xs.fromPromise(tono5k.howToQuiz(quiz.update.factId).then(quizInfo => {
            quiz.quizInfo = quizInfo;
            return quiz;
        })))
        .flatten().remember() as MemoryStream<WhatToQuizInfo>;
    const known$ = sources.known;
    // quiz$.addListener({ next: x => console.log('quiz3', x) })

    const quizDom$ = quiz$.map(quiz => quiz && quiz.risky ? quizToDOM(quiz) : null);
    const answerButton$ = xs.merge(sources.DOM.select('form').events('submit').map(e => {
        e.preventDefault();
        var node = (document.querySelector('#answer-text') as any);
        return node ? node.value : null;
    }).filter(x => x !== null),
        sources.DOM.select('button.answer').events('click').map(e => +(e.target.id.split('-')[1]))) as xs<number | string>;
    const questionAnswer$ = answerButton$.compose(sampleCombine(quiz$));
    const questionAnswerResult$ = questionAnswer$.map(([ans, quiz]) => checkAnswer([ans, quiz]));
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