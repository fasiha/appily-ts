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
var ebisu_1 = require("./ebisu");
var utils_1 = require("./utils");
var tono5k_1 = require("./tono5k");
var newlyLearned = ebisu_1.ebisu.defaultModel(0.25, 2.5);
var buryForever = ebisu_1.ebisu.defaultModel(Infinity);
exports.tono5kCli = { administerQuiz: administerQuiz, findAndLearn: findAndLearn, stripFactIdOfSubfact: tono5k_1.tono5k.stripFactIdOfSubfact };
var TONO_URL = "https://raw.githubusercontent.com/fasiha/tono-yamazaki-maekawa/master/tono.json";
var node_fetch_1 = require("node-fetch");
var dataPromise = node_fetch_1.default(TONO_URL).then(function (res) { return res.text(); }).then(function (s) { return tono5k_1.tono5k.setup([s]); });
function findAndLearn(submit, knownFactIds) {
    return __awaiter(this, void 0, void 0, function () {
        var fact, _a, _b, start_1, typed, factIds;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = tono5k_1.tono5k).whatToLearn;
                    return [4 /*yield*/, dataPromise];
                case 1: return [4 /*yield*/, _b.apply(_a, [_c.sent(), knownFactIds])];
                case 2:
                    fact = _c.sent();
                    if (!fact) return [3 /*break*/, 4];
                    console.log("Hey! Learn this:");
                    console.log(fact);
                    if (fact.kanjis.length) {
                        console.log('http://jisho.org/search/%23kanji%20' + encodeURI(stringsToUniqueCharString(fact.kanjis)));
                    }
                    console.log('Hit Enter when you got it. (Control-C to quit without committing to learn this.)');
                    start_1 = new Date();
                    return [4 /*yield*/, utils_1.cliPrompt()];
                case 3:
                    typed = _c.sent();
                    factIds = tono5k_1.tono5k.factToFactIds(fact);
                    factIds.forEach(function (factId) { return submit(factId, newlyLearned, { firstLearned: true, hoursWaited: utils_1.elapsedHours(start_1) }); });
                    return [3 /*break*/, 5];
                case 4:
                    console.log("No new facts to learn. Go outside and play!");
                    _c.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
;
function administerQuiz(doneQuizzing, factId, allUpdates) {
    return __awaiter(this, void 0, void 0, function () {
        var quiz, _a, _b, fact, alpha, info, result, start, responseText, responseIdx, responseText;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log("\u00A1\u00A1\u00A1\uD83C\uDF86 QUIZ TIME \uD83C\uDF87!!!");
                    _b = (_a = tono5k_1.tono5k).howToQuiz;
                    return [4 /*yield*/, dataPromise];
                case 1:
                    quiz = _b.apply(_a, [_c.sent(), factId]);
                    fact = quiz.fact;
                    alpha = 'ABCDEFGHIJKLM'.split('');
                    start = new Date();
                    if (!(utils_1.endsWith(factId, '-kanji') || utils_1.endsWith(factId, '-meaning'))) return [3 /*break*/, 3];
                    if (utils_1.endsWith(factId, '-kanji')) {
                        console.log("What\u2019s the kanji for: " + fact.readings.join('・') + " and meaning \u300C" + fact.meaning + "\u300D?");
                        quiz.confusers.forEach(function (fact, idx) { return console.log(alpha[idx] + ". " + fact.kanjis.join('・')); });
                    }
                    else {
                        // meaning quiz
                        console.log("What\u2019s the meaning of: " + (fact.kanjis.length ? fact.kanjis.join('・') + ', ' : '') + fact.readings.join('・') + "?");
                        quiz.confusers.forEach(function (fact, idx) { return console.log(alpha[idx] + ". " + fact.meaning); });
                    }
                    return [4 /*yield*/, utils_1.cliPrompt()];
                case 2:
                    responseText = _c.sent();
                    responseIdx = alpha.indexOf(responseText.toUpperCase());
                    if (responseIdx < 0 || responseIdx >= quiz.confusers.length) {
                        console.log('Ummm… you ok?');
                        return [2 /*return*/];
                    }
                    result = quiz.confusers[responseIdx].num === fact.num;
                    info = {
                        result: result,
                        response: quiz.confusers[responseIdx].num,
                        confusers: quiz.confusers.map(function (fact) { return fact.num; })
                    };
                    return [3 /*break*/, 5];
                case 3:
                    if (fact.kanjis.length) {
                        console.log("What\u2019s the reading for: " + fact.kanjis.join('・') + ", \u300C" + fact.meaning + "\u300D?");
                    }
                    else {
                        console.log("What\u2019s the reading for: \u300C" + fact.meaning + "\u300D?");
                    }
                    return [4 /*yield*/, utils_1.cliPrompt()];
                case 4:
                    responseText = _c.sent();
                    result = fact.readings.indexOf(responseText) >= 0;
                    info = { result: result, response: responseText };
                    _c.label = 5;
                case 5:
                    info.hoursWaited = utils_1.elapsedHours(start);
                    return [4 /*yield*/, doneQuizzing(factId, allUpdates, info)];
                case 6:
                    _c.sent();
                    if (result) {
                        console.log('✅✅✅!');
                    }
                    else {
                        console.log('❌❌❌', fact);
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function stringsToUniqueCharString(arr) {
    return Array.from(new Set(arr.join('').split(''))).join('');
}
//# sourceMappingURL=tono5k-cli.js.map