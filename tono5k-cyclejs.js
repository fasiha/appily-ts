"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tono5k_1 = require("./tono5k");
var utils_1 = require("./utils");
var xstream_1 = require("xstream");
var dom_1 = require("@cycle/dom");
var sampleCombine_1 = require("xstream/extra/sampleCombine");
exports.tono5kCyclejs = {
    makeDOMStream: makeDOMStream,
    stripFactIdOfSubfact: tono5k_1.tono5k.stripFactIdOfSubfact,
    factToFactIds: tono5k_1.tono5k.factToFactIds
};
function quizToDOM(quiz) {
    var factId = quiz.update.factId;
    var howToQuiz = quiz.howToQuiz;
    var fact = howToQuiz.fact;
    var vec = [];
    if (utils_1.endsWith(factId, '-kanji') || utils_1.endsWith(factId, '-meaning')) {
        var confusers = howToQuiz.confusers;
        if (utils_1.endsWith(factId, '-kanji')) {
            var s = "What\u2019s the kanji for: " + fact.readings.join('・') + " and meaning \u300C" + fact.meaning + "\u300D?";
            vec.push(dom_1.p(s));
            vec.push(dom_1.ol(confusers.map(function (fact, idx) { return dom_1.li([dom_1.button("#answer-" + idx + ".answer", "" + (idx + 1)), dom_1.span(" " + fact.kanjis.join('・'))]); })));
        }
        else {
            var s = "What\u2019s the meaning of: " + (fact.kanjis.length ? fact.kanjis.join('・') + ', ' : '') + fact.readings.join('・') + "?";
            vec.push(dom_1.p(s));
            vec.push(dom_1.ol(confusers.map(function (fact, idx) { return dom_1.li([dom_1.button("#answer-" + idx + ".answer", "" + (idx + 1)), dom_1.span(" " + fact.meaning)]); })));
        }
    }
    else {
        if (fact.kanjis.length) {
            vec.push(dom_1.p("What\u2019s the reading for: " + fact.kanjis.join('・') + ", \u300C" + fact.meaning + "\u300D?"));
        }
        else {
            vec.push(dom_1.p("What\u2019s the reading for: \u300C" + fact.meaning + "\u300D?"));
        }
        vec.push(dom_1.form('.answer-form', { attrs: { autocomplete: "off", action: 'javascript:void(0);' } }, [dom_1.input('#answer-text', { type: "text", placeholder: "Doo bee doo bee doo" }),
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
        // Typed in the exact answer OR added a `suru` OR omitted `suru`
        result = (howToQuiz.fact.readings.indexOf(answer) >= 0 ||
            howToQuiz.fact.readings.map(function (s) { return s.replace(/[（）]/g, ''); }).indexOf(answer) >= 0 ||
            howToQuiz.fact.readings.map(function (s) { return s.split(/[（）]/)[0]; }).indexOf(answer) >= 0);
        info.result = result;
        info.response = answer;
    }
    else {
        result = howToQuiz.confusers[answer].num === howToQuiz.fact.num;
        info.result = result;
        info.response = howToQuiz.confusers[answer].num;
        info.confusers = howToQuiz.confusers.map(function (fact) { return fact.num; });
    }
    ;
    // console.log('COMMITTING!', info);
    return { DOM: dom_1.p(result ? '✅✅✅!' : '❌❌❌'), sink: [answer, quiz, info] };
}
function newFactToDom(fact) {
    if (!fact) {
        return null;
    }
    return dom_1.div([
        dom_1.p("Hey! Learn this: " + JSON.stringify(fact)),
        dom_1.button("#learned-button", "Learned!"),
        dom_1.p([
            dom_1.input('#suggest-text', { attrs: { type: "text", placeholder: "Looking for something special?" } }),
            dom_1.button("#suggest-button", "Search")
        ])
    ]);
}
function makeDOMStream(sources) {
    var factData$ = sources.params
        .map(function (docparam) {
        return xstream_1.default.fromPromise(Promise.all(docparam.sources.map(function (url) { return fetch(url)
            .then(function (res) { return res.text(); }); }))
            .then(function (raws) { return tono5k_1.tono5k.setup(raws); }));
    })
        .flatten()
        .remember();
    var quiz$ = xstream_1.default.combine(sources.quiz, factData$)
        .map(function (_a) {
        var quiz = _a[0], factData = _a[1];
        quiz.howToQuiz = tono5k_1.tono5k.howToQuiz(factData, quiz.update.factId);
        return quiz;
    })
        .remember();
    var known$ = sources.known;
    // quiz$.addListener({ next: x => console.log('quiz3', x) })
    // `quiz.quizInfo` is null when the FactDb couldn't find a fact that goes with this fact id. When this happens, under normal conditions, the app should "fake" a review or somehow update the fact so it doesn't come up as most likely to be forgotten (i.e., other facts can be reviewed), but for now, while we hammer out the details of userParams, just don't display anything.
    var quizDom$ = quiz$.map(function (quiz) { return quiz && quiz.risky && quiz.howToQuiz ? quizToDOM(quiz) : null; });
    var answerButton$ = xstream_1.default.merge(sources.DOM.select('form').events('submit').map(function (e) {
        e.preventDefault();
        var node = document.querySelector('#answer-text');
        return node ? node.value : null;
    }).filter(function (x) { return x !== null; }), sources.DOM.select('button.answer').events('click').map(function (e) { return +(e.target.id.split('-')[1]); }));
    var questionAnswer$ = answerButton$.compose(sampleCombine_1.default(quiz$));
    var questionAnswerResult$ = questionAnswer$.map(function (_a) {
        var ans = _a[0], quiz = _a[1];
        return checkAnswer([ans, quiz]);
    });
    var questionAnswerSink$ = questionAnswerResult$.map(function (o) { return o.sink; });
    var questionAnswerDom$ = questionAnswerResult$.map(function (o) { return o.DOM; });
    var quizAllDom$ = xstream_1.default.merge(questionAnswerDom$, quizDom$).startWith(null);
    var requested$ = sources.DOM.select('button#suggest-button')
        .events('click')
        .map(function (_) { return document.querySelector("input#suggest-text").value; });
    // requested$.addListener({ next: x => console.log('requested', x) });
    var background$ = xstream_1.default.combine(known$, factData$);
    var backgroundRequested$ = requested$.compose(sampleCombine_1.default(background$))
        .map(function (_a) {
        var suggestion = _a[0], _b = _a[1], knownFactIds = _b[0], factData = _b[1];
        return [knownFactIds, factData, suggestion];
    });
    // backgroundRequested$.addListener({ next: x => console.log('backgroundRequested$', x) });
    var fact$ = xstream_1.default.merge(backgroundRequested$, background$).map(function (x) {
        var knownFactIds = x[0];
        var factData = x[1];
        var request = x[2];
        return tono5k_1.tono5k.whatToLearn(factData, knownFactIds, request);
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
//# sourceMappingURL=tono5k-cyclejs.js.map