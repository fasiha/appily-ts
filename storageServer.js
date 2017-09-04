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
// import Kefir = require("kefir");
var xstream_1 = require("xstream");
var ebisu_1 = require("./ebisu");
var utils_1 = require("./utils");
;
function createFactUpdateKeys(user, docId, factId, createdAt) {
    var historic = "hi::" + user + "::" + docId + "::" + factId + "::" + createdAt.toISOString();
    var current = "cu::" + user + "::" + docId + "::" + factId + "::";
    return [historic, current];
}
function submit(db, user, docId, factId, ebisuObject, updateObject) {
    if (updateObject === void 0) { updateObject = {}; }
    return __awaiter(this, void 0, void 0, function () {
        var createdAt, keys, u, ustr;
        return __generator(this, function (_a) {
            createdAt = new Date();
            keys = createFactUpdateKeys(user, docId, factId, createdAt);
            u = { user: user, docId: docId, factId: factId, createdAt: createdAt, ebisuObject: ebisuObject, updateObject: updateObject };
            ustr = JSON.stringify(u);
            Promise.all(keys.map(function (key) { return db.putAsync(key, ustr); }))
                .catch(function (e) { return console.error('Submit error', e); });
            return [2 /*return*/];
        });
    });
}
exports.submit = submit;
function levelStreamToXstream(levelStream) {
    return xstream_1.default.create({
        start: function (listener) {
            levelStream.on('data', function (data) { return listener.next(data); });
            levelStream.on('close', function () { return listener.complete(); });
        },
        stop: function () { }
    });
}
function leveldbToKeyStream(db, opts) {
    return levelStreamToXstream(db.createKeyStream(opts));
}
exports.leveldbToKeyStream = leveldbToKeyStream;
function leveldbToValueStream(db, opts) {
    return levelStreamToXstream(db.createValueStream(opts));
}
exports.leveldbToValueStream = leveldbToValueStream;
function leveldbToStream(db, opts) {
    return levelStreamToXstream(db.createReadStream(opts));
}
exports.leveldbToStream = leveldbToStream;
function makeLeveldbOpts(user, docId, factId, factIdFragment) {
    if (docId === void 0) { docId = ''; }
    if (factId === void 0) { factId = ''; }
    if (factIdFragment === void 0) { factIdFragment = true; }
    var ret = function (a, b) { return ({ gte: a, lt: b }); };
    var a = "cu::" + user;
    var b = "cu::" + user;
    if (docId.length) {
        a += "::" + docId;
        b += "::" + docId;
    }
    else {
        a += '::';
        b += ';';
        return ret(a, b);
    }
    if (factId.length) {
        a += "::" + factId;
        b += "::" + factId;
        if (factIdFragment) {
            b += '\ufff0';
        }
        else {
            a += '::';
            b += ';';
        }
        return ret(a, b);
    }
    else {
        a += '::';
        b += ';';
    }
    return ret(a, b);
}
exports.makeLeveldbOpts = makeLeveldbOpts;
function getCurrentUpdates(db, opts) {
    if (opts === void 0) { opts = {}; }
    return leveldbToValueStream(db, opts)
        .map(function (v) { return JSON.parse(v); });
}
exports.getCurrentUpdates = getCurrentUpdates;
function factUpdateToProb(f, dnow) {
    // JSON converts Infinity to `null` :-/
    if (f.ebisuObject[2] && isFinite(f.ebisuObject[2])) {
        return ebisu_1.ebisu.predictRecall(f.ebisuObject, utils_1.elapsedHours(new Date(f.createdAt), dnow));
    }
    return 1;
}
;
function getMostForgottenFact(db, opts) {
    if (opts === void 0) { opts = {}; }
    var dnow = new Date();
    return getCurrentUpdates(db, opts)
        .map(function (f) { return [f, factUpdateToProb(f, dnow)]; })
        .fold(function (_a, _b) {
        var f0 = _a[0], p0 = _a[1];
        var f1 = _b[0], p1 = _b[1];
        return p1 < p0 ? [f1, p1] : [f0, p0];
    }, [null, 1])
        .last();
}
exports.getMostForgottenFact = getMostForgottenFact;
function getKnownFactIds(db, opts) {
    if (opts === void 0) { opts = {}; }
    var keys = leveldbToKeyStream(db, opts);
    return keys.map(function (s) { return s.split('::')[3]; });
}
exports.getKnownFactIds = getKnownFactIds;
function doneQuizzing(db, USER, DOCID, factId, allUpdates, info) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, allUpdates_1, u, newEbisu;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _i = 0, allUpdates_1 = allUpdates;
                    _a.label = 1;
                case 1:
                    if (!(_i < allUpdates_1.length)) return [3 /*break*/, 6];
                    u = allUpdates_1[_i];
                    if (!(u.factId === factId)) return [3 /*break*/, 3];
                    // active update
                    info.wasActiveRecall = true;
                    newEbisu = ebisu_1.ebisu.updateRecall(u.ebisuObject, info.result, utils_1.elapsedHours(new Date(u.createdAt)));
                    return [4 /*yield*/, submit(db, USER, DOCID, factId, newEbisu, info)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    // passive update: update the timestamp, keep the ebisu prior the same.
                    info.wasActiveRecall = false;
                    return [4 /*yield*/, submit(db, USER, DOCID, u.factId, u.ebisuObject, info)];
                case 4:
                    _a.sent();
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    });
}
exports.doneQuizzing = doneQuizzing;
function getUserParams(db, username) {
    var key = "us::" + username + "::params";
    return leveldbToValueStream(db, { gte: key, lt: key + '\u0000' })
        .map(function (v) { return JSON.parse(v); });
}
exports.getUserParams = getUserParams;
function setUserParams(db, username, params) {
    return __awaiter(this, void 0, void 0, function () {
        var key;
        return __generator(this, function (_a) {
            key = "us::" + username + "::params";
            return [2 /*return*/, db.putAsync(key, JSON.stringify(params))];
        });
    });
}
exports.setUserParams = setUserParams;
//# sourceMappingURL=storageServer.js.map