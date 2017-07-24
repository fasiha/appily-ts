import levelup = require('levelup');
import xs from 'xstream';
import { db } from "./diskDb";
import {
    getMostForgottenFact, omitNonlatestUpdates, getKnownFactIds,
    makeLeveldbOpts, submit, FactDb, doneQuizzing
} from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { xstreamToPromise } from "./utils";

const express = require('express');
const bodyParser = require('body-parser');

const port = 3001;
const app = express();
app.set('x-powered-by', false);
app.use(bodyParser.json());
app.use('/', express.static('client'));

import { SubmitToServer, MostForgottenToServer, MostForgottenFromServer, KnownFactIdsToServer, KnownFactIdsFromServer, DoneQuizzingToServer } from "./RestInterfaces";

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

app.listen(port, () => { console.log(`Started: http://127.0.0.1:${port}`) });
