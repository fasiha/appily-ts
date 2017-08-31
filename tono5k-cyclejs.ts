import { Tono, TonoData, HowToQuizInfo, tono5k } from "./tono5k";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import { WhatToQuizInfo, FactDbCycle, WhatToLearnInfo, CycleSinks, CycleSources } from "./cycleInterfaces";

import xs, { MemoryStream } from 'xstream';
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
    const howToQuiz = quiz.howToQuiz;
    const fact: Tono = howToQuiz.fact;
    let vec = [];
    if (endsWith(factId, '-kanji') || endsWith(factId, '-meaning')) {
        const confusers: Tono[] = howToQuiz.confusers;
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



function checkAnswer([answer, quiz]: [number | string, WhatToQuizInfo]): { DOM: VNode, sink: [any, WhatToQuizInfo, any] } {
    let result: boolean;
    let info: any = { hoursWaited: elapsedHours(quiz.startTime) };
    const howToQuiz: HowToQuizInfo = quiz.howToQuiz;
    if (typeof answer === 'string') {
        result = howToQuiz.fact.readings.indexOf(answer) >= 0;
        info.result = result;
        info.response = answer;
    } else {
        result = howToQuiz.confusers[answer].num === howToQuiz.fact.num
        info.result = result;
        info.response = howToQuiz.confusers[answer].num;
        info.confusers = howToQuiz.confusers.map(fact => fact.num);
    };
    // console.log('COMMITTING!', info);
    return { DOM: p(result ? '✅✅✅!' : '❌❌❌'), sink: [answer, quiz, info] };
}


function newFactToDom(fact: any): VNode {
    if (!fact) { return null; }
    return div([p("Hey! Learn this: " + JSON.stringify(fact)),
    button("#learned-button", "Learned!")]);
}

function makeDOMStream(sources: CycleSources): CycleSinks {
    const factData$: MemoryStream<TonoData> = sources.params
        .map(docparam => {
            return xs.fromPromise(Promise.all(
                docparam.sources.map(url => fetch(url)
                    .then(res => res.text())))
                .then(raws => tono5k.setup(raws)));
        })
        .flatten()
        .remember();

    const quiz$: MemoryStream<WhatToQuizInfo> = xs.combine(sources.quiz, factData$)
        .map(([quiz, factData]: [WhatToQuizInfo, TonoData]) => {
            quiz.howToQuiz = tono5k.howToQuiz(factData, quiz.update.factId);
            return quiz;
        })
        .remember();
    const known$ = sources.known;
    // quiz$.addListener({ next: x => console.log('quiz3', x) })

    // `quiz.quizInfo` is null when the FactDb couldn't find a fact that goes with this fact id. When this happens, under normal conditions, the app should "fake" a review or somehow update the fact so it doesn't come up as most likely to be forgotten (i.e., other facts can be reviewed), but for now, while we hammer out the details of userParams, just don't display anything.
    const quizDom$ = quiz$.map(quiz => quiz && quiz.risky && quiz.howToQuiz ? quizToDOM(quiz) : null);

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

    const fact$ = xs.combine(known$, factData$).map(([knownFactIds, factData]) => (tono5k.whatToLearn(factData, knownFactIds))).remember();
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