import { WEB_URL, Fact, HowToQuizInfo, ToponymsData, toponyms } from "./toponyms";
import { furiganaStringToReading, parseMarkdownLinkRuby, furiganaStringToPlain, Furigana, Ruby } from "./ruby";

import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import { WhatToQuizInfo, FactDbCycle, WhatToLearnInfo, CycleSinks, CycleSources } from "./cycleInterfaces";

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import { run } from '@cycle/run';
import { div, button, p, ol, li, span, input, form, makeDOMDriver, VNode } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'


export const toponymsCyclejs: FactDbCycle = {
    makeDOMStream,
    stripFactIdOfSubfact: toponyms.stripFactIdOfSubfact,
    factToFactIds: toponyms.factToFactIds
};

function quizToDOM(quiz: WhatToQuizInfo): VNode {
    const factId = quiz.update.factId;
    const howToQuiz = quiz.howToQuiz;
    const fact: Fact = howToQuiz.fact;
    let vec = [];
    if (endsWith(factId, '-kanji')) {
        const confusers: Fact[] = howToQuiz.confusers;
        let s = `What’s the kanji for: ${furiganaStringToReading(fact)}`;
        vec.push(p(s));
        vec.push(ol(confusers.map((fact, idx) => li([button(`#answer-${idx}.answer`, `${idx + 1}`), span(` ${furiganaStringToPlain(fact)}`)]))));
    } else {
        vec.push(p(`What’s the reading for: ${furiganaStringToPlain(fact)}`));
        vec.push(form('.answer-form', { attrs: { autocomplete: "off", action: 'javascript:void(0);' } },
            [input('#answer-text', { attrs: { autocomplete: "off", type: "text", placeholder: "Doo bee doo bee doo" } }),
            button('#answer-submit', 'Submit')]));
    }
    return div([p(`¡¡¡QUIZ TIME!!! ${quiz.prob.toFixed(5)}`)].concat(vec));
}



function checkAnswer([answer, quiz]: [number | string, WhatToQuizInfo]): { DOM: VNode, sink: [any, WhatToQuizInfo, any] } {
    let result: boolean;
    let info: any = { hoursWaited: elapsedHours(quiz.startTime) };
    const howToQuiz: HowToQuizInfo = quiz.howToQuiz;
    if (typeof answer === 'string') {
        result = furiganaStringToReading(howToQuiz.fact) === answer;
        info.result = result;
        info.response = answer;
    } else {
        // result = furiganaStringToPlain(confusers[responseIdx]) === furiganaStringToPlain(fact);
        result = furiganaStringToPlain(howToQuiz.confusers[answer]) === furiganaStringToPlain(howToQuiz.fact);
        info.result = result;
        info.response = furiganaStringToPlain(howToQuiz.confusers[answer]);
        info.confusers = howToQuiz.confusers.map(furiganaStringToPlain);
    };
    // console.log('COMMITTING!', info);
    return { DOM: p(result ? '✅✅✅!' : '❌❌❌'), sink: [answer, quiz, info] };
}


function newFactToDom(fact): VNode {
    if (!fact) { return null; }
    return div([p("Hey! Learn this: " + JSON.stringify(fact)),
    button("#learned-button", "Learned!")]);
}

function makeDOMStream(sources: CycleSources): CycleSinks {
    const factData$: MemoryStream<ToponymsData> = sources.params
        .map(docparam => {
            return xs.fromPromise(Promise.all(
                docparam.sources.map(url => fetch(url)
                    .then(res => res.text())))
                .then(raws => toponyms.setup(raws)));
        })
        .flatten()
        .remember();

    const quiz$ = xs.combine(sources.quiz, factData$)
        .map(([quiz, factData]: [WhatToQuizInfo, ToponymsData]) => xs.fromPromise(toponyms.howToQuiz(factData, quiz.update.factId).then(howToQuiz => {
            quiz.howToQuiz = howToQuiz;
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
    const questionAnswerResult$ = questionAnswer$/*.filter(([ans, quiz] )=> !!quiz)*/.map(([ans, quiz]) => checkAnswer([ans, quiz]));
    const questionAnswerSink$ = questionAnswerResult$.map(o => o.sink);
    const questionAnswerDom$ = questionAnswerResult$.map(o => o.DOM);
    const quizAllDom$ = xs.merge(questionAnswerDom$, quizDom$);

    const fact$ = xs.combine(known$, factData$).map(([knownFactIds, factData]) => xs.fromPromise(toponyms.whatToLearn(factData, knownFactIds))).flatten().remember();
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