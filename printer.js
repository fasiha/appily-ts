"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var levelup = require("levelup");
var assert = require('assert');
assert(process.argv.length >= 3 && process.argv[2].length > 0);
var db = levelup(process.argv[2]);
db.createReadStream().on('data', function (_a) {
    var key = _a.key, value = _a.value;
    return console.log(key + "\u2192" + value);
});
//# sourceMappingURL=printer.js.map