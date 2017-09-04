"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var levelup = require("levelup");
var crypto_1 = require("crypto");
var fs_1 = require("fs");
var assert = require('assert');
assert(process.argv.length >= 3 && process.argv[2].length > 0);
var datafile = process.argv[2];
var db = levelup('temp-' + crypto_1.randomBytes(4).toString('hex'));
var bluebird = require("bluebird");
bluebird.promisifyAll(db);
var data = fs_1.readFileSync(datafile, 'utf8').trim().split('\n').map(function (line) { return line.split('→'); });
function dump(data, db) {
    return Promise.all(data.map(function (_a) {
        var k = _a[0], v = _a[1];
        return db.putAsync(k, v);
    }));
}
dump(data, db).then(function (_) {
    db.createReadStream().on('data', function (_a) {
        var key = _a.key, value = _a.value;
        return console.log(key + "\u2192" + value);
    });
});
//# sourceMappingURL=scanner.js.map