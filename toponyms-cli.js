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
var ruby_1 = require("./ruby");
var toponyms_1 = require("./toponyms");
var newlyLearned = ebisu_1.ebisu.defaultModel(0.25, 2.5);
var buryForever = ebisu_1.ebisu.defaultModel(Infinity);
function factIdToURL(s) {
    return toponyms_1.WEB_URL + "#" + encodeURI(toponyms_1.toponyms.stripFactIdOfSubfact(s));
}
exports.toponymsCli = { administerQuiz: administerQuiz, findAndLearn: findAndLearn, stripFactIdOfSubfact: toponyms_1.toponyms.stripFactIdOfSubfact };
var TOPONYMS_URL = "https://raw.githubusercontent.com/fasiha/toponyms-and-nymes/gh-pages/README.md";
var node_fetch_1 = require("node-fetch");
var dataPromise = node_fetch_1.default(TOPONYMS_URL).then(function (res) { return res.text(); }).then(function (s) { return toponyms_1.toponyms.setup([s]); });
function findAndLearn(submit, knownFactIds) {
    return __awaiter(this, void 0, void 0, function () {
        var fact, _a, _b, factIds, start, typed;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _b = (_a = toponyms_1.toponyms).whatToLearn;
                    return [4 /*yield*/, dataPromise];
                case 1: return [4 /*yield*/, _b.apply(_a, [_c.sent(), knownFactIds])];
                case 2:
                    fact = _c.sent();
                    if (!fact) return [3 /*break*/, 4];
                    factIds = toponyms_1.toponyms.factToFactIds(fact);
                    console.log("Hey! Learn this:");
                    console.log(fact);
                    console.log(factIdToURL(factIds[0]));
                    console.log('http://jisho.org/search/%23kanji%20' + encodeURI(fact
                        .filter(function (f) { return typeof (f) !== 'string'; })
                        .map(function (f) { return f.ruby; }).join('')));
                    console.log('Hit Enter when you got it. (Control-C to quit without committing to learn this.)');
                    start = new Date();
                    return [4 /*yield*/, utils_1.cliPrompt()];
                case 3:
                    typed = _c.sent();
                    factIds.forEach(function (factId) { return submit(factId, newlyLearned, { firstLearned: true, hoursWaited: utils_1.elapsedHours(start) }); });
                    return [3 /*break*/, 5];
                case 4:
                    console.log("No new facts to learn. Go outside and play!");
                    _c.label = 5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
// export async function administerQuiz(doneQuizzing:DoneQuizzingFunction, factId: string, allUpdates: FactUpdate[]) {
function administerQuiz(doneQuizzing, factId, allUpdates) {
    return __awaiter(this, void 0, void 0, function () {
        var quiz, _a, _b, fact, alpha, info, result, start, confusers, responseText, responseIdx, responseText;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    console.log("\u00A1\u00A1\u00A1\uD83C\uDF86 QUIZ TIME \uD83C\uDF87!!!");
                    _b = (_a = toponyms_1.toponyms).howToQuiz;
                    return [4 /*yield*/, dataPromise];
                case 1: return [4 /*yield*/, _b.apply(_a, [_c.sent(), factId])];
                case 2:
                    quiz = _c.sent();
                    fact = quiz.fact;
                    alpha = 'ABCDEFGHIJKLM'.split('');
                    start = new Date();
                    if (!(factId.indexOf('-kanji') >= 0)) return [3 /*break*/, 4];
                    confusers = quiz.confusers;
                    console.log("What\u2019s the kanji for: " + ruby_1.furiganaStringToReading(fact) + "?");
                    confusers.forEach(function (fact, idx) { return console.log(alpha[idx] + ". " + ruby_1.furiganaStringToPlain(fact)); });
                    return [4 /*yield*/, utils_1.cliPrompt()];
                case 3:
                    responseText = _c.sent();
                    responseIdx = alpha.indexOf(responseText.toUpperCase());
                    if (responseIdx < 0 || responseIdx >= confusers.length) {
                        console.log('Ummm… you ok?');
                        return [2 /*return*/];
                    }
                    result = ruby_1.furiganaStringToPlain(confusers[responseIdx]) === ruby_1.furiganaStringToPlain(fact);
                    info = {
                        result: result,
                        response: ruby_1.furiganaStringToPlain(confusers[responseIdx]),
                        confusers: confusers.map(ruby_1.furiganaStringToPlain)
                    };
                    return [3 /*break*/, 6];
                case 4:
                    console.log("What\u2019s the reading for: " + ruby_1.furiganaStringToPlain(fact));
                    return [4 /*yield*/, utils_1.cliPrompt()];
                case 5:
                    responseText = _c.sent();
                    result = responseText === ruby_1.furiganaStringToReading(fact);
                    info = { result: result, response: responseText };
                    _c.label = 6;
                case 6:
                    info.hoursWaited = utils_1.elapsedHours(start);
                    return [4 /*yield*/, doneQuizzing(factId, allUpdates, info)];
                case 7:
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
//# sourceMappingURL=toponyms-cli.js.map