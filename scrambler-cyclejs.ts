import { Fact, HowToQuizInfo, ScramblerData, scrambler } from "./scrambler";
import { xstreamToPromise, endsWith, elapsedHours } from "./utils";
import { WhatToQuizInfo, FactDbCycle, WhatToLearnInfo, CycleSinks, CycleSources } from "./cycleInterfaces";

import xs from 'xstream';
import { MemoryStream } from 'xstream';
import { run } from '@cycle/run';
import { div, button, p, ol, li, span, input, form, makeDOMDriver, VNode } from '@cycle/dom';
import sampleCombine from 'xstream/extra/sampleCombine'

export const scramblerCyclejs: FactDbCycle = {
    makeDOMStream,
    stripFactIdOfSubfact: scrambler.stripFactIdOfSubfact,
    factToFactIds: scrambler.factToFactIds
};

function quizToDOM(quiz: WhatToQuizInfo, answer: string): VNode {
    const factId = quiz.update.factId;
    const howToQuiz: HowToQuizInfo = quiz.howToQuiz;
    const fact: Fact = howToQuiz.fact;


    let vec = [p(`¡¡¡QUIZ TIME!!! ${quiz.prob.toFixed(5)}`),
    p('「' + fact.translation + '」'),
    ol(".abc-bullets", howToQuiz.scrambled.map(s => li(s)))];
    vec.push(form('.answer-form', { attrs: { autocomplete: "off", action: 'javascript:void(0);' } },
        [input('#answer-text', { type: "text", placeholder: "Separate by spaces or commas" }),
        button('#answer-submit', 'Submit')]));

    const idxs = answer.split(/\D+/).map(s => parseFloat(s) - 1);
    const scrambled = howToQuiz.scrambled;
    const reconstructed = idxs.map(i => scrambled[i]).join('');
    vec.push(p(`So far: 「${reconstructed}」.`))

    return div(vec);
}



function checkAnswer([answer, quiz]: [string, WhatToQuizInfo]): { DOM: VNode, sink: [any, WhatToQuizInfo, any] } {
    let result: boolean;
    const howToQuiz: HowToQuizInfo = quiz.howToQuiz;
    const scrambled = howToQuiz.scrambled;
    const fact = howToQuiz.fact;

    const idxs = answer.split(/\D+/).map(s => parseFloat(s) - 1);
    const reconstructed = idxs.map(i => scrambled[i]).join('');
    result = reconstructed === fact.text;

    let info: any = { hoursWaited: elapsedHours(quiz.startTime), result, reconstructed };

    // console.log('COMMITTING!', info);
    return { DOM: p(result ? '✅✅✅!' : '❌❌❌'), sink: [answer, quiz, info] };
}


function newFactToDom(fact): VNode {
    if (!fact) { return null; }
    return div([p("Hey! Learn this: " + JSON.stringify(fact)),
    button("#learned-button", "Learned!")]);
}

function makeDOMStream(sources: CycleSources): CycleSinks {
    const factData$: MemoryStream<ScramblerData> = sources.params
        .map(docparam => {
            return xs.fromPromise(Promise.all(
                docparam.sources.map(url => fetch(url)
                    .then(res => res.text())))
                .then(raws => scrambler.setup(raws)));
        })
        .flatten()
        .remember();

    const quiz$: MemoryStream<WhatToQuizInfo> = xs.combine(sources.quiz, factData$)
        .map(([quiz, factData]: [WhatToQuizInfo, ScramblerData]) => {
            quiz.howToQuiz = scrambler.howToQuiz(factData, quiz.update.factId);
            return quiz;
        })
        .remember();
    const known$ = sources.known;
    // quiz$.addListener({ next: x => console.log('quiz3', x) })


    const typing$ = sources.DOM.select('#answer-text').events('input').map(e => e.target.value).startWith('') as MemoryStream<string>;
    const quizDom$ = xs.combine(quiz$, typing$).map(([quiz, answer]) => quiz && quiz.risky ? quizToDOM(quiz, answer) : null);

    const answerButton$ = sources.DOM.select('form').events('submit').map(e => {
        e.preventDefault();
        var node = (document.querySelector('#answer-text') as any);
        return node ? node.value : null;
    }).filter(x => x !== null) as xs<string>;
    const questionAnswer$ = answerButton$.compose(sampleCombine(quiz$));
    const questionAnswerResult$ = questionAnswer$.map(([ans, quiz]) => checkAnswer([ans, quiz]));
    const questionAnswerSink$ = questionAnswerResult$.map(o => o.sink);
    const questionAnswerDom$ = questionAnswerResult$.map(o => o.DOM);
    const quizAllDom$ = xs.merge(questionAnswerDom$, quizDom$);

    const fact$ = xs.combine(known$, factData$).map(([knownFactIds, factData]) => xs.fromPromise(scrambler.whatToLearn(factData, knownFactIds))).flatten().remember();
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