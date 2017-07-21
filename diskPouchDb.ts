import PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-adapter-node-websql'));
PouchDB.plugin(require('pouchdb-upsert'));

export type Db = PouchDB.Database<{}>;
export let db: Db = new PouchDB('mypouchdb.db', { adapter: 'websql' /*, revs_limit: 2 */ });
// export let db: Db = new PouchDB('./mypouchlevel');
