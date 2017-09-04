"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var toponyms_1 = require("./toponyms");
var ruby_1 = require("./ruby");
var utils_1 = require("./utils");
var xstream_1 = require("xstream");
var dom_1 = require("@cycle/dom");
var sampleCombine_1 = require("xstream/extra/sampleCombine");
exports.toponymsCyclejs = {
    makeDOMStream: makeDOMStream,
    stripFactIdOfSubfact: toponyms_1.toponyms.stripFactIdOfSubfact,
    factToFactIds: toponyms_1.toponyms.factToFactIds
};
function quizToDOM(quiz) {
    var factId = quiz.update.factId;
    var howToQuiz = quiz.howToQuiz;
    var fact = howToQuiz.fact;
    var vec = [];
    if (utils_1.endsWith(factId, '-kanji')) {
        var confusers = howToQuiz.confusers;
        var s = "What\u2019s the kanji for: " + ruby_1.furiganaStringToReading(fact);
        vec.push(dom_1.p(s));
        vec.push(dom_1.ol(confusers.map(function (fact, idx) { return dom_1.li([dom_1.button("#answer-" + idx + ".answer", "" + (idx + 1)), dom_1.span(" " + ruby_1.furiganaStringToPlain(fact))]); })));
    }
    else {
        vec.push(dom_1.p("What\u2019s the reading for: " + ruby_1.furiganaStringToPlain(fact)));
        vec.push(dom_1.form('.answer-form', { attrs: { autocomplete: "off", action: 'javascript:void(0);' } }, [dom_1.input('#answer-text', { attrs: { autocomplete: "off", type: "text", placeholder: "Doo bee doo bee doo" } }),
            dom_1.button('#answer-submit', 'Submit')]));
    }
    return dom_1.div([dom_1.p("\u00A1\u00A1\u00A1QUIZ TIME!!! " + quiz.prob.toFixed(5))].concat(vec));
}
function checkAnswer(_a) {
    var answer = _a[0], quiz = _a[1];
    var result;
    var info = { hoursWaited: utils_1.elapsedHours(quiz.startTime) };
    var howToQuiz = quiz.howToQuiz;
    if (typeof answer === 'string') {
        result = ruby_1.furiganaStringToReading(howToQuiz.fact) === answer;
        info.result = result;
        info.response = answer;
    }
    else {
        // result = furiganaStringToPlain(confusers[responseIdx]) === furiganaStringToPlain(fact);
        result = ruby_1.furiganaStringToPlain(howToQuiz.confusers[answer]) === ruby_1.furiganaStringToPlain(howToQuiz.fact);
        info.result = result;
        info.response = ruby_1.furiganaStringToPlain(howToQuiz.confusers[answer]);
        info.confusers = howToQuiz.confusers.map(ruby_1.furiganaStringToPlain);
    }
    ;
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
            .then(function (raws) { return toponyms_1.toponyms.setup(raws); }));
    })
        .flatten()
        .remember();
    var quiz$ = xstream_1.default.combine(sources.quiz, factData$)
        .map(function (_a) {
        var quiz = _a[0], factData = _a[1];
        quiz.howToQuiz = toponyms_1.toponyms.howToQuiz(factData, quiz.update.factId);
        return quiz;
    })
        .remember();
    var known$ = sources.known;
    // quiz$.addListener({ next: x => console.log('quiz3', x) })
    var quizDom$ = quiz$.map(function (quiz) { return quiz && quiz.risky ? quizToDOM(quiz) : null; });
    var answerButton$ = xstream_1.default.merge(sources.DOM.select('form').events('submit').map(function (e) {
        e.preventDefault();
        var node = document.querySelector('#answer-text');
        return node ? node.value : null;
    }).filter(function (x) { return x !== null; }), sources.DOM.select('button.answer').events('click').map(function (e) { return +(e.target.id.split('-')[1]); }));
    var questionAnswer$ = answerButton$.compose(sampleCombine_1.default(quiz$));
    var questionAnswerResult$ = questionAnswer$ /*.filter(([ans, quiz] )=> !!quiz)*/.map(function (_a) {
        var ans = _a[0], quiz = _a[1];
        return checkAnswer([ans, quiz]);
    });
    var questionAnswerSink$ = questionAnswerResult$.map(function (o) { return o.sink; });
    var questionAnswerDom$ = questionAnswerResult$.map(function (o) { return o.DOM; });
    var quizAllDom$ = xstream_1.default.merge(questionAnswerDom$, quizDom$).startWith(null);
    var fact$ = xstream_1.default.combine(known$, factData$).map(function (_a) {
        var knownFactIds = _a[0], factData = _a[1];
        return (toponyms_1.toponyms.whatToLearn(factData, knownFactIds));
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
//# sourceMappingURL=toponyms-cyclejs.js.map