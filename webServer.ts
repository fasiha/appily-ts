import levelup = require('levelup');
import xs from 'xstream';
import { db, usersDb } from "./diskDb";
import { FactDb, UserParams, getMostForgottenFact, getCurrentUpdates, getKnownFactIds, makeLeveldbOpts, submit, doneQuizzing, getUserParams, setUserParams } from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { xstreamToPromise } from "./utils";
import { SubmitToServer, MostForgottenToServer, MostForgottenFromServer, KnownFactIdsToServer, KnownFactIdsFromServer, DoneQuizzingToServer } from "./restInterfaces";

import { readFileSync } from 'fs';
const config = JSON.parse(readFileSync(__dirname + '/.data/default.json', 'utf8'));

const assert = require('assert');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const LevelStore = require('level-session-store')(session);
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const btoa = require('btoa');
import { randomBytes } from 'crypto';

// Express setup
assert(config.sessionSecret);

const port = process.env.PORT || 3001;
const app = express();
app.set('x-powered-by', false);
app.use(bodyParser.json());
app.use('/', express.static('client'));
app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    httpOnly: true,
    sameSite: true,
    maxAge: 3e11, // roughly 3e10 milliseconds in a year
    store: new LevelStore()
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport setup
assert(config.github && config.github.clientId && config.github.clientSecret);

function profileToKey(profile): string {
    return btoa(profile.provider + '-' + profile.id);
}

passport.serializeUser((user, done) => {
    return done(null, profileToKey(user));
});

passport.deserializeUser((id, done) => {
    usersDb.get(id, (err, val) => {
        if (err) {
            console.error(`Couldn’t deserialize ${id}`);
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
    callbackURL: `${config.baseurl}/auth/github/callback`
},
    function (accessToken, refreshToken, profile, done) {
        const key = profileToKey(profile);
        const appKey = randomBytes(12).toString('base64');
        const newProfile = { appKey, provider: profile.provider, id: profile.id };
        usersDb.get(key, (err, val) => {
            if (val) {
                done(null, JSON.parse(val));
                return;
            }
            usersDb.put(key, JSON.stringify(newProfile));

            const params: UserParams = { id: appKey, doctypes: [] };
            setUserParams(db, appKey, params);

            done(null, newProfile);
        })
    }));

app.get('/auth/github', passport.authenticate('github', { scope: [''] }));

app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => res.redirect('/'));

app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});


// Rest API
async function submitFunction(db, user, submitted: SubmitToServer) {
    submit(db, user, submitted.docId, submitted.factId, submitted.ebisuObject, submitted.updateObject);
}

app.post('/api/submit', ensureAuthenticated, async (req, res) => {
    const b: SubmitToServer = req.body;
    const user = req.user && req.user.appKey;
    submitFunction(db, user, b);
    res.status(200).send('OK');
})

async function mostForgottenFunction(db, user, submitted: MostForgottenToServer): Promise<MostForgottenFromServer> {
    const [update, prob] = (await xstreamToPromise(getMostForgottenFact(db, makeLeveldbOpts(user, submitted.soleDocId))))[0];
    return { prob, update };
}

app.post('/api/mostForgotten', ensureAuthenticated, async (req, res) => {
    const user = req.user && req.user.appKey;
    res.json(await mostForgottenFunction(db, user, req.body));
})

async function knownFactIdsFunction(db, user, submitted: KnownFactIdsToServer): Promise<KnownFactIdsFromServer> {
    const opts = makeLeveldbOpts(user, submitted.docId);
    return xstreamToPromise(getKnownFactIds(db, opts));
}
app.post('/api/knownFactIds', ensureAuthenticated, async (req, res) => {
    const user = req.user && req.user.appKey;
    const done = await knownFactIdsFunction(db, user, req.body);
    res.json(done);
})

async function doneQuizzingFunction(db, user, submitted: DoneQuizzingToServer) {
    assert(submitted.activelyQuizzedFactId);
    const streams = submitted.allQuizzedFactIds.map(factId => getCurrentUpdates(db, makeLeveldbOpts(user, submitted.docId, factId, true)))
    const allUpdates = await xstreamToPromise(xs.merge(...streams));
    doneQuizzing(db, user, submitted.docId, submitted.activelyQuizzedFactId, allUpdates, submitted.infos[0])
    // todo: small: enhance doneQuizzing to use different factIds and infos, since a quiz might not passively review *all* subfacts
}
app.post('/api/doneQuizzing', ensureAuthenticated, async (req, res) => {
    const user = req.user && req.user.appKey;
    doneQuizzingFunction(db, user, req.body);
    res.status(200).send('OK');
})

app.get('/api/private', ensureAuthenticated, (req, res) => {
    res.json(req.user);
})

app.get('/api/userParams', ensureAuthenticated, async (req, res) => {
    const user: string = req.user && req.user.appKey;
    const params = (await xstreamToPromise(getUserParams(db, user)))[0];
    res.json(params);
});
app.post('/api/userParams', ensureAuthenticated, async (req, res) => {
    const user: string = req.user && req.user.appKey;
    const params = req.body;
    setUserParams(db, user, params);
    res.status(200).send('OK');
});



app.listen(port, () => { console.log(`Started: http://127.0.0.1:${port}`) });

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.status(401).send('unauthorized');
}