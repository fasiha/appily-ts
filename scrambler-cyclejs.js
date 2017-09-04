"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var scrambler_1 = require("./scrambler");
var utils_1 = require("./utils");
var xstream_1 = require("xstream");
var dom_1 = require("@cycle/dom");
var sampleCombine_1 = require("xstream/extra/sampleCombine");
exports.scramblerCyclejs = {
    makeDOMStream: makeDOMStream,
    stripFactIdOfSubfact: scrambler_1.scrambler.stripFactIdOfSubfact,
    factToFactIds: scrambler_1.scrambler.factToFactIds
};
function quizToDOM(quiz, answer) {
    var factId = quiz.update.factId;
    var howToQuiz = quiz.howToQuiz;
    var fact = howToQuiz.fact;
    var idxs = answer.split(/\D+/).map(function (s) { return parseFloat(s) - 1; });
    var vec = [dom_1.p("\u00A1\u00A1\u00A1QUIZ TIME!!! " + quiz.prob.toFixed(5)),
        dom_1.p('「' + fact.translation + '」'),
        dom_1.ol(".abc-bullets", howToQuiz.scrambled.map(function (s, idx) { return dom_1.li(idxs.indexOf(idx) >= 0 ? '.grayed' : '', s); }))];
    vec.push(dom_1.form('.answer-form', { attrs: { autocomplete: "off", action: 'javascript:void(0);' } }, [dom_1.input('#answer-text', { type: "text", placeholder: "Separate by spaces or commas" }),
        dom_1.button('#answer-submit', 'Submit')]));
    var scrambled = howToQuiz.scrambled;
    var reconstructed = idxs.map(function (i) { return scrambled[i]; }).join('');
    vec.push(dom_1.p("So far: \u300C" + reconstructed + "\u300D."));
    return dom_1.div(vec);
}
function checkAnswer(_a) {
    var answer = _a[0], quiz = _a[1];
    var result;
    var howToQuiz = quiz.howToQuiz;
    var scrambled = howToQuiz.scrambled;
    var fact = howToQuiz.fact;
    var idxs = answer.split(/\D+/).map(function (s) { return parseFloat(s) - 1; });
    var reconstructed = idxs.map(function (i) { return scrambled[i]; }).join('');
    result = reconstructed === fact.text;
    var info = { hoursWaited: utils_1.elapsedHours(quiz.startTime), result: result, reconstructed: reconstructed };
    // console.log('COMMITTING!', info);
    return { DOM: dom_1.p(result ? '✅✅✅!' : '❌❌❌'), sink: [answer, quiz, info] };
}
function newFactToDom(fact) {
    if (!fact) {
        return null;
    }
    return dom_1.div([dom_1.p("Hey! Learn this: " + JSON.stringify(fact)),
        dom_1.button("#learned-button", "Learned!")]);
}
function makeDOMStream(sources) {
    var factData$ = sources.params
        .map(function (docparam) {
        return xstream_1.default.fromPromise(Promise.all(docparam.sources.map(function (url) { return fetch(url)
            .then(function (res) { return res.text(); }); }))
            .then(function (raws) { return scrambler_1.scrambler.setup(raws); }));
    })
        .flatten()
        .remember();
    var quiz$ = xstream_1.default.combine(sources.quiz, factData$)
        .map(function (_a) {
        var quiz = _a[0], factData = _a[1];
        quiz.howToQuiz = scrambler_1.scrambler.howToQuiz(factData, quiz.update.factId);
        return quiz;
    })
        .remember();
    var known$ = sources.known;
    // quiz$.addListener({ next: x => console.log('quiz3', x) })
    var typing$ = sources.DOM.select('#answer-text').events('input').map(function (e) { return e.target.value; }).startWith('');
    var quizDom$ = xstream_1.default.combine(quiz$, typing$).map(function (_a) {
        var quiz = _a[0], answer = _a[1];
        return quiz && quiz.risky ? quizToDOM(quiz, answer) : null;
    });
    var answerButton$ = sources.DOM.select('form').events('submit').map(function (e) {
        e.preventDefault();
        var node = document.querySelector('#answer-text');
        return node ? node.value : null;
    }).filter(function (x) { return x !== null; });
    var questionAnswer$ = answerButton$.compose(sampleCombine_1.default(quiz$));
    var questionAnswerResult$ = questionAnswer$.map(function (_a) {
        var ans = _a[0], quiz = _a[1];
        return checkAnswer([ans, quiz]);
    });
    var questionAnswerSink$ = questionAnswerResult$.map(function (o) { return o.sink; });
    var questionAnswerDom$ = questionAnswerResult$.map(function (o) { return o.DOM; });
    var quizAllDom$ = xstream_1.default.merge(questionAnswerDom$, quizDom$).startWith(null);
    var fact$ = xstream_1.default.combine(known$, factData$).map(function (_a) {
        var knownFactIds = _a[0], factData = _a[1];
        return (scrambler_1.scrambler.whatToLearn(factData, knownFactIds));
    }).remember();
    var factDom$ = fact$.map(function (fact) { return fact ? newFactToDom(fact) : null; });
    var learnedFact$ = sources.DOM.select('button#learned-button').events('click').compose(sampleCombine_1.default(fact$)).map(function (_a) {
        var _ = _a[0], fact = _a[1];
        return fact;
    });
    var learnedFactDom$ = learnedFact$.map(function (fact) { return dom_1.p("Great!"); });
    var learnAllDom$ = xstream_1.default.merge(factDom$, learnedFactDom$).startWith(null);
    var vdom$ = xstream_1.default.merge(quizAllDom$, learnAllDom$).filter(function (x) { return !!x; }).startWith(null);
    return {
        DOM: vdom$,
        learned: learnedFact$,
        quizzed: questionAnswerSink$
    };
}
//# sourceMappingURL=scrambler-cyclejs.js.map