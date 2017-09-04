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
var storageServer_1 = require("./storageServer");
var diskDb_1 = require("./diskDb");
var utils_1 = require("./utils");
var USER = 'Zok4J4riZWgWNhKQ';
var PROB_THRESH = 0.25;
// Import all FactDb-implementing modules, then add them to the docid2module map!
var toponyms_cli_1 = require("./toponyms-cli");
var tono5k_cli_1 = require("./tono5k-cli");
var docid2module = new Map([["toponyms", toponyms_cli_1.toponymsCli], ["tono5k", tono5k_cli_1.tono5kCli]]);
function makeSubmitFunction(db, user, docId) {
    var f = function (factId, ebisuObject, updateObject) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, storageServer_1.submit(db, user, docId, factId, ebisuObject, updateObject)];
            });
        });
    };
    return f;
}
function makeDoneQuizzingFunction(db, user, docId) {
    var g = function (factId, allUpdates, info) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, storageServer_1.doneQuizzing(db, user, docId, factId, allUpdates, info)];
            });
        });
    };
    return g;
}
function loop(SOLE_DOCID) {
    if (SOLE_DOCID === void 0) { SOLE_DOCID = ''; }
    return __awaiter(this, void 0, void 0, function () {
        var levelOpts, _a, update0, prob0, docId, factdb, plain0, allRelatedUpdates, factdb, _b, _c, _d, _i, _e, _f, docId, factdb, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    levelOpts = storageServer_1.makeLeveldbOpts(USER, SOLE_DOCID);
                    return [4 /*yield*/, utils_1.xstreamToPromise(storageServer_1.getMostForgottenFact(diskDb_1.db, levelOpts))];
                case 1:
                    _a = (_k.sent())[0], update0 = _a[0], prob0 = _a[1];
                    if (!(prob0 && prob0 <= PROB_THRESH)) return [3 /*break*/, 4];
                    docId = update0.docId;
                    factdb = docid2module.get(docId);
                    plain0 = factdb.stripFactIdOfSubfact(update0.factId);
                    return [4 /*yield*/, utils_1.xstreamToPromise(storageServer_1.getCurrentUpdates(diskDb_1.db, storageServer_1.makeLeveldbOpts(USER, docId, plain0, true)))];
                case 2:
                    allRelatedUpdates = _k.sent();
                    console.log("Review!", prob0);
                    return [4 /*yield*/, factdb.administerQuiz(makeDoneQuizzingFunction(diskDb_1.db, USER, docId), update0.factId, allRelatedUpdates)];
                case 3:
                    _k.sent();
                    return [3 /*break*/, 12];
                case 4:
                    if (!SOLE_DOCID) return [3 /*break*/, 7];
                    factdb = docid2module.get(SOLE_DOCID);
                    _c = (_b = factdb).findAndLearn;
                    _d = [makeSubmitFunction(diskDb_1.db, USER, SOLE_DOCID)];
                    return [4 /*yield*/, utils_1.xstreamToPromise(storageServer_1.getKnownFactIds(diskDb_1.db, storageServer_1.makeLeveldbOpts(USER, SOLE_DOCID)))];
                case 5: return [4 /*yield*/, _c.apply(_b, _d.concat([_k.sent()]))];
                case 6:
                    _k.sent();
                    return [3 /*break*/, 12];
                case 7:
                    _i = 0, _e = Array.from(docid2module.entries());
                    _k.label = 8;
                case 8:
                    if (!(_i < _e.length)) return [3 /*break*/, 12];
                    _f = _e[_i], docId = _f[0], factdb = _f[1];
                    _h = (_g = factdb).findAndLearn;
                    _j = [makeSubmitFunction(diskDb_1.db, USER, docId)];
                    return [4 /*yield*/, utils_1.xstreamToPromise(storageServer_1.getKnownFactIds(diskDb_1.db, storageServer_1.makeLeveldbOpts(USER, docId)))];
                case 9: return [4 /*yield*/, _h.apply(_g, _j.concat([_k.sent()]))];
                case 10:
                    _k.sent();
                    _k.label = 11;
                case 11:
                    _i++;
                    return [3 /*break*/, 8];
                case 12: return [2 /*return*/];
            }
        });
    });
}
if (require.main === module) {
    if (process.argv.length <= 2) {
        loop();
    }
    else {
        var t = process.argv[2];
        if (docid2module.has(t)) {
            loop(t);
        }
        else {
            console.log("Couldn't find fact-document \u201C" + t + "\u201D. Available:");
            console.log(Array.from(docid2module.keys()).map(function (s) { return '- ' + s; }).join('\n'));
            console.log('Running standard setup.');
            loop();
        }
    }
}
//# sourceMappingURL=cli.js.map