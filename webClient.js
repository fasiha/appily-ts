"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var xstream_1 = require("xstream");
var isolate_1 = require("@cycle/isolate");
var run_1 = require("@cycle/run");
var dom_1 = require("@cycle/dom");
var http_1 = require("@cycle/http");
var ebisu_1 = require("./ebisu");
// Import all FactDb-implementing modules, then add them to the docid2module map!
var toponyms_cyclejs_1 = require("./toponyms-cyclejs");
var tono5k_cyclejs_1 = require("./tono5k-cyclejs");
var scrambler_cyclejs_1 = require("./scrambler-cyclejs");
var docid2module = new Map([
    ["toponyms", toponyms_cyclejs_1.toponymsCyclejs],
    ["tono5k", tono5k_cyclejs_1.tono5kCyclejs],
    ["scrambler", scrambler_cyclejs_1.scramblerCyclejs],
]);
var PROB_THRESH = 0.25;
var newlyLearned = ebisu_1.ebisu.defaultModel(0.25, 2.5);
var TONO_URL = "https://raw.githubusercontent.com/fasiha/tono-yamazaki-maekawa/master/tono.json";
// Database
// Wrapper around all fact databases
function postObject(obj) {
    return {
        headers: { 'Content-Type': 'application/json' },
        method: "POST",
        body: JSON.stringify(obj),
        credentials: 'include'
    };
}
function webSubmit(docId, factId, ebisuObject, updateObject) {
    return __awaiter(this, void 0, void 0, function () {
        var submitting;
        return __generator(this, function (_a) {
            submitting = { docId: docId, factId: factId, ebisuObject: ebisuObject, updateObject: updateObject };
            return [2 /*return*/, fetch('/api/submit', postObject(submitting))];
        });
    });
}
function getMostForgottenFact(soleDocId) {
    return __awaiter(this, void 0, void 0, function () {
        var submitting, got, update, prob, docId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    submitting = { soleDocId: soleDocId };
                    return [4 /*yield*/, fetch('/api/mostForgotten', postObject(submitting))];
                case 1: return [4 /*yield*/, (_a.sent()).json()];
                case 2:
                    got = _a.sent();
                    update = got.update;
                    prob = got.prob;
                    docId = update && update.docId;
                    return [2 /*return*/, { update: update, prob: prob, docId: docId, risky: prob && prob <= PROB_THRESH && docid2module.has(update.docId), startTime: new Date() }];
            }
        });
    });
}
function getKnownFactIds(docId) {
    return __awaiter(this, void 0, void 0, function () {
        var submitting;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    submitting = { docId: docId };
                    return [4 /*yield*/, fetch('/api/knownFactIds', postObject(submitting))];
                case 1: return [2 /*return*/, (_a.sent()).json()];
            }
        });
    });
}
function doneLearning(docId, factIds, updateObjects) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, Promise.all(factIds.map(function (factId, idx) { return webSubmit(docId, factId, newlyLearned, updateObjects[idx]); }))];
        });
    });
}
function doneQuizzing(docId, activelyQuizzedFactId, allQuizzedFactIds, infos) {
    var submitting = { docId: docId, activelyQuizzedFactId: activelyQuizzedFactId, allQuizzedFactIds: allQuizzedFactIds, infos: infos };
    return fetch('/api/doneQuizzing', postObject(submitting));
}
function paramsDOM(params) {
    // let docsSources = new Map(params.doctypes.map(doctype => [doctype.name, doctype.sources.join(',')]));
    var docSources = new Map();
    for (var _i = 0, _a = params.doctypes; _i < _a.length; _i++) {
        var doctype = _a[_i];
        docSources.set(doctype.name, doctype.sources.join(','));
    }
    for (var _b = 0, _c = Array.from(docid2module.keys()); _b < _c.length; _b++) {
        var key = _c[_b];
        if (!docSources.has(key)) {
            docSources.set(key, '');
        }
    }
    return dom_1.div([
        dom_1.ul(Array.from(docSources.entries()).map(function (_a) {
            var docId = _a[0], val = _a[1];
            return dom_1.li([
                dom_1.span(docId + ' '),
                dom_1.input(".appended .appended-" + docId, { attrs: { type: 'text', value: val } })
            ]);
        })),
        dom_1.button('#params-save', 'Save')
    ]);
    // Save *SHOULD* update the stream so I don't have to refresh
}
function main(sources) {
    var doctypeParams$ = sources.DOM.select('button#params-save')
        .events('click')
        .map(function (_) { return Array.from(document.querySelectorAll("input.appended")).map(function (x) { return ({
        name: x.className.match(/appended-\S+/)[0].split('-').slice(1).join('-'),
        sources: x.value ? x.value.trim().split(/\s+/) : []
    }); }); });
    // doctypeParams$.addListener({ next: x => console.log('doctypes', x) });
    // Login
    var getAuthStatus$ = xstream_1.default.of(true).mapTo({ url: '/api/private', category: 'ping', method: 'GET' });
    var getUserParams$ = xstream_1.default.of({ url: '/api/userParams', category: 'params', method: 'GET' });
    var userParams$ = sources.HTTP.select('params')
        .flatten()
        .map(function (res) { return res.body; })
        .replaceError(function (e) { return xstream_1.default.of(null); });
    // userParams$.addListener({ next: x => console.log('userParams', x) });
    var updatedUserParams$ = xstream_1.default.combine(userParams$, doctypeParams$).map(function (_a) {
        var userParams = _a[0], doctypes = _a[1];
        var newParams = { id: userParams.id, displayName: userParams.displayName, doctypes: doctypes };
        return { url: 'api/userParams', category: 'writeParams', method: 'POST', send: newParams };
    });
    var authStatus$ = sources.HTTP.select('ping')
        .flatten()
        .map(function (o) { return !o.unauthorized; })
        .replaceError(function (e) { return xstream_1.default.of(false); });
    var authDom$ = xstream_1.default.combine(authStatus$, userParams$).map(function (_a) {
        var loggedIn = _a[0], params = _a[1];
        if (loggedIn) {
            return dom_1.div([
                dom_1.p('Logged in!'),
                paramsDOM(params),
                dom_1.button('.hit-me', 'Hit me')
            ]);
        }
        else {
            return dom_1.a({ attrs: { href: "/auth/github" } }, 'Log in with GitHub!');
        }
    }).remember();
    // SRS
    var action$ = sources.DOM.select('.hit-me').events('click').mapTo(0);
    var SOLE_DOCID = '';
    var quiz$ = action$.map(function (_) { return xstream_1.default.fromPromise(getMostForgottenFact(SOLE_DOCID)); })
        .flatten()
        .remember();
    // quiz$.addListener({ next: x => console.log('quiz', x) })
    function docIdModToKnownStream(docId, mod) {
        return quiz$
            .filter(function (q) { return q && !q.risky; })
            .map(function (_) { return xstream_1.default.fromPromise(getKnownFactIds(docId)); })
            .flatten()
            .remember();
    }
    var sinks = Array.from(docid2module.entries()).map(function (_a) {
        var docId = _a[0], mod = _a[1];
        var mysources = {
            DOM: sources.DOM,
            quiz: quiz$.filter(function (quiz) { return quiz && quiz.risky && quiz.docId === docId; }),
            known: docIdModToKnownStream(docId, mod),
            params: userParams$.filter(function (x) { return !!x; }).map(function (params) { return params.doctypes.find(function (doctype) { return doctype.name === docId; }); }).filter(function (x) { return !!x; })
        };
        var all = isolate_1.default(mod.makeDOMStream)(mysources);
        all.learned.addListener({
            next: function (fact) {
                var relateds = docid2module.get(docId).factToFactIds(fact);
                doneLearning(docId, relateds, relateds.map(function (_) { return ({ firstLearned: true }); }));
            }
        });
        all.quizzed.addListener({
            next: function (_a) {
                var ans = _a[0], quiz = _a[1], info = _a[2];
                var docId = quiz.update.docId;
                var fact = quiz.howToQuiz.fact;
                doneQuizzing(docId, quiz.update.factId, docid2module.get(docId).factToFactIds(fact), [info]);
            }
        });
        return all;
    });
    var allDom$ = xstream_1.default.merge.apply(xstream_1.default, sinks.map(function (o) { return o.DOM; }));
    var loginPlusAll$ = xstream_1.default.combine(authDom$, allDom$);
    var vdom$ = loginPlusAll$.map(function (_a) {
        var login = _a[0], element = _a[1];
        return dom_1.div([
            login,
            element
        ]);
    });
    var httpRequests$ = xstream_1.default.merge(getUserParams$, getAuthStatus$, updatedUserParams$);
    return {
        DOM: vdom$,
        HTTP: httpRequests$
    };
}
run_1.run(main, {
    DOM: dom_1.makeDOMDriver('#app'),
    HTTP: http_1.makeHTTPDriver()
});
//# sourceMappingURL=webClient.js.map