"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var levelup = require("levelup");
exports.db = levelup('./.data/mydb');
var bluebird = require("bluebird");
bluebird.promisifyAll(exports.db);
// see https://github.com/petkaantonov/bluebird/issues/304#issuecomment-274362312
exports.usersDb = levelup('./.data/myusers');
bluebird.promisifyAll(exports.usersDb);
//# sourceMappingURL=diskDb.js.map