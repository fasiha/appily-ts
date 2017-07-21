import levelup = require("levelup");
export var db: levelup.LevelUpBase<levelup.Batch> = levelup('./mydb');
import bluebird = require('bluebird');
bluebird.promisifyAll(db);
// see https://github.com/petkaantonov/bluebird/issues/304#issuecomment-274362312

export type Db = levelup.LevelUpBase<levelup.Batch>;
