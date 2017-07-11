import levelup = require('levelup');
import { makeShoeInit, db } from "./storageServer";

const express = require('express');
const shoe = require('shoe');

const port = 3001;
const app = express();
app.use('/', express.static('client'));


const sock = shoe(makeShoeInit(db));
sock.install(app.listen(port, () => { console.log(`Started: http://127.0.0.1:${port}`) }), '/api/ml');
