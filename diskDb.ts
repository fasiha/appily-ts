import levelup = require("levelup");
import bluebird = require('bluebird');
export var db: levelup.LevelUpBase<levelup.Batch> = levelup('./mydb');
bluebird.promisifyAll(db);
// see https://github.com/petkaantonov/bluebird/issues/304#issuecomment-274362312

