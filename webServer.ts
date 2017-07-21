import { db, pouchdbImport } from "./diskPouchDb";

const express = require('express');

const port = 3001;
const app = express();
app.use('/', express.static('client'));
app.use('/db', require('express-pouchdb')(pouchdbImport, { mode: 'fullCouchDB' }));
app.listen(port, () => console.log('Running!'));
