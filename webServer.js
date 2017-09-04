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
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var xstream_1 = require("xstream");
var diskDb_1 = require("./diskDb");
var storageServer_1 = require("./storageServer");
var utils_1 = require("./utils");
var fs_1 = require("fs");
var config = JSON.parse(fs_1.readFileSync(__dirname + '/.data/default.json', 'utf8'));
var assert = require('assert');
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var LevelStore = require('level-session-store')(session);
var passport = require('passport');
var GitHubStrategy = require('passport-github2').Strategy;
var btoa = require('btoa');
var crypto_1 = require("crypto");
// Express setup
assert(config.sessionSecret);
var port = process.env.PORT || 3001;
var app = express();
app.set('x-powered-by', false);
app.use(bodyParser.json());
app.use('/', express.static('client'));
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    httpOnly: true,
    sameSite: true,
    maxAge: 3e11,
    store: new LevelStore()
}));
app.use(passport.initialize());
app.use(passport.session());
// Passport setup
assert(config.github && config.github.clientId && config.github.clientSecret);
function profileToKey(profile) {
    return btoa(profile.provider + '-' + profile.id);
}
passport.serializeUser(function (user, done) {
    return done(null, profileToKey(user));
});
passport.deserializeUser(function (id, done) {
    diskDb_1.usersDb.get(id, function (err, val) {
        if (err) {
            console.error("Couldn\u2019t deserialize " + id);
            done(err, null);
            return;
        }
        done(null, JSON.parse(val));
    });
});
assert(config.baseurl);
passport.use(new GitHubStrategy({
    clientID: config.github.clientId,
    clientSecret: config.github.clientSecret,
    callbackURL: config.baseurl + "/auth/github/callback"
}, function (accessToken, refreshToken, profile, done) {
    var key = profileToKey(profile);
    var appKey = crypto_1.randomBytes(12).toString('base64');
    var newProfile = { appKey: appKey, provider: profile.provider, id: profile.id };
    diskDb_1.usersDb.get(key, function (err, val) {
        if (val) {
            done(null, JSON.parse(val));
            return;
        }
        diskDb_1.usersDb.put(key, JSON.stringify(newProfile));
        var params = { id: appKey, doctypes: [] };
        storageServer_1.setUserParams(diskDb_1.db, appKey, params);
        done(null, newProfile);
    });
}));
app.get('/auth/github', passport.authenticate('github', { scope: [''] }));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), function (req, res) { return res.redirect('/'); });
app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});
// Rest API
function submitFunction(db, user, submitted) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            storageServer_1.submit(db, user, submitted.docId, submitted.factId, submitted.ebisuObject, submitted.updateObject);
            return [2 /*return*/];
        });
    });
}
app.post('/api/submit', ensureAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
    var b, user;
    return __generator(this, function (_a) {
        b = req.body;
        user = req.user && req.user.appKey;
        submitFunction(diskDb_1.db, user, b);
        res.status(200).send('OK');
        return [2 /*return*/];
    });
}); });
function mostForgottenFunction(db, user, submitted) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, update, prob;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, utils_1.xstreamToPromise(storageServer_1.getMostForgottenFact(db, storageServer_1.makeLeveldbOpts(user, submitted.soleDocId)))];
                case 1:
                    _a = (_b.sent())[0], update = _a[0], prob = _a[1];
                    return [2 /*return*/, { prob: prob, update: update }];
            }
        });
    });
}
app.post('/api/mostForgotten', ensureAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
    var user, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                user = req.user && req.user.appKey;
                _b = (_a = res).json;
                return [4 /*yield*/, mostForgottenFunction(diskDb_1.db, user, req.body)];
            case 1:
                _b.apply(_a, [_c.sent()]);
                return [2 /*return*/];
        }
    });
}); });
function knownFactIdsFunction(db, user, submitted) {
    return __awaiter(this, void 0, void 0, function () {
        var opts;
        return __generator(this, function (_a) {
            opts = storageServer_1.makeLeveldbOpts(user, submitted.docId);
            return [2 /*return*/, utils_1.xstreamToPromise(storageServer_1.getKnownFactIds(db, opts))];
        });
    });
}
app.post('/api/knownFactIds', ensureAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
    var user, done;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                user = req.user && req.user.appKey;
                return [4 /*yield*/, knownFactIdsFunction(diskDb_1.db, user, req.body)];
            case 1:
                done = _a.sent();
                res.json(done);
                return [2 /*return*/];
        }
    });
}); });
function doneQuizzingFunction(db, user, submitted) {
    return __awaiter(this, void 0, void 0, function () {
        var streams, allUpdates;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    assert(submitted.activelyQuizzedFactId);
                    streams = submitted.allQuizzedFactIds.map(function (factId) { return storageServer_1.getCurrentUpdates(db, storageServer_1.makeLeveldbOpts(user, submitted.docId, factId, true)); });
                    return [4 /*yield*/, utils_1.xstreamToPromise(xstream_1.default.merge.apply(xstream_1.default, streams))];
                case 1:
                    allUpdates = _a.sent();
                    storageServer_1.doneQuizzing(db, user, submitted.docId, submitted.activelyQuizzedFactId, allUpdates, submitted.infos[0]);
                    return [2 /*return*/];
            }
        });
    });
}
app.post('/api/doneQuizzing', ensureAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
    var user;
    return __generator(this, function (_a) {
        user = req.user && req.user.appKey;
        doneQuizzingFunction(diskDb_1.db, user, req.body);
        res.status(200).send('OK');
        return [2 /*return*/];
    });
}); });
app.get('/api/private', ensureAuthenticated, function (req, res) {
    res.json(req.user);
});
app.get('/api/userParams', ensureAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
    var user, params;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                user = req.user && req.user.appKey;
                return [4 /*yield*/, utils_1.xstreamToPromise(storageServer_1.getUserParams(diskDb_1.db, user))];
            case 1:
                params = (_a.sent())[0];
                res.json(params);
                return [2 /*return*/];
        }
    });
}); });
app.post('/api/userParams', ensureAuthenticated, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
    var user, params;
    return __generator(this, function (_a) {
        user = req.user && req.user.appKey;
        params = req.body;
        storageServer_1.setUserParams(diskDb_1.db, user, params);
        res.status(200).send('OK');
        return [2 /*return*/];
    });
}); });
app.listen(port, function () { console.log("Started: http://127.0.0.1:" + port); });
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).send('unauthorized');
}
//# sourceMappingURL=webServer.js.map