import levelup = require('levelup');
import xs from 'xstream';
import { db, usersDb } from "./diskDb";
import {
    getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, FactDb, doneQuizzing
} from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { xstreamToPromise } from "./utils";
import { SubmitToServer, MostForgottenToServer, MostForgottenFromServer, KnownFactIdsToServer, KnownFactIdsFromServer, DoneQuizzingToServer } from "./restInterfaces";

const assert = require('assert');
const config = require('config');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const LevelStore = require('level-session-store')(session);
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const btoa = require('btoa');

// Express setup
assert(config.has('sessionSecret'));

const port = 3001;
const app = express();
app.set('x-powered-by', false);
app.use(bodyParser.json());
app.use('/', express.static('client'));
app.use(session({
    secret: config.get('sessionSecret'),
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
assert(config.has('github.clientId') && config.has('github.clientSecret'));

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

passport.use(new GitHubStrategy({
    clientID: config.get('github.clientId'),
    clientSecret: config.get('github.clientSecret'),
    callbackURL: `http://127.0.0.1:${port}/auth/github/callback`
},
    function (accessToken, refreshToken, profile, done) {
        const key = profileToKey(profile);
        profile.appKey = key;
        usersDb.get(key, (err, val) => {
            if (val) {
                done(null, JSON.parse(val));
                return;
            }
            usersDb.put(key, JSON.stringify(profile));
            done(null, profile);
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

app.post('/api/submit', async (req, res) => {
    const b: SubmitToServer = req.body;
    const user = (req.session && req.session.user) || 'ammy';
    submitFunction(db, user, b);
    res.status(200).send('OK');
})

async function mostForgottenFunction(db, user, submitted: MostForgottenToServer): Promise<MostForgottenFromServer> {
    const [update, prob] = (await xstreamToPromise(getMostForgottenFact(db, makeLeveldbOpts(user, submitted.soleDocId))))[0];
    return { prob, update };
}

app.post('/api/mostForgotten', async (req, res) => {
    const user = (req.session && req.session.user) || 'ammy';
    res.json(await mostForgottenFunction(db, user, req.body));
})

async function knownFactIdsFunction(db, user, submitted: KnownFactIdsToServer): Promise<KnownFactIdsFromServer> {
    const opts = makeLeveldbOpts(user, submitted.docId);
    return xstreamToPromise(getKnownFactIds(db, opts));
}
app.post('/api/knownFactIds', async (req, res) => {
    const user = (req.session && req.session.user) || 'ammy';
    const done = await knownFactIdsFunction(db, user, req.body);
    res.json(done);
})

async function doneQuizzingFunction(db, user, submitted: DoneQuizzingToServer) {
    const streams = submitted.allQuizzedFactIds.map(factId => omitNonlatestUpdates(db, makeLeveldbOpts(user, submitted.docId, factId, true)))
    const allUpdates = await xstreamToPromise(xs.merge(...streams));
    doneQuizzing(db, user, submitted.docId, submitted.activelyQuizzedFactId, allUpdates, submitted.infos[0])
    // todo: small: enhance doneQuizzing to use different factIds and infos, since a quiz might not passively review *all* subfacts
    // todo: BIG: separate history & current streams in level.
}
app.post('/api/doneQuizzing', async (req, res) => {
    const user = (req.session && req.session.user) || 'ammy';
    doneQuizzingFunction(db, user, req.body);
    res.status(200).send('OK');
})

app.get('/api/private', ensureAuthenticated, (req, res) => {
    res.json(req.user);
})

app.listen(port, () => { console.log(`Started: http://127.0.0.1:${port}`) });

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.status(401).send('unauthorized');

}