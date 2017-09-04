"use strict";
/*
This converts a Appily level database printout (made via printDatedDb.ts), in
the old v1 format, of `${user}::${docid}::${factid}::${createdAt}` to the new
v2 format of `cu::${user}::${docid}::${factid}::` AND
`hi::${user}::${docid}::${factid}::${createdAt}`, where the former is
`hi`storic and the latter is `cu`rrent (or the latest) updates.
*/
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var rows = fs_1.readFileSync('mydb.txt', 'utf8').trim().split('\n').map(function (s) { return s.split('→'); });
var mAll = new Map([]);
var mLatest = new Map([]);
rows.forEach(function (_a) {
    var key = _a[0], val = _a[1];
    var thiskey = key.split('::').slice(0, -1).join('::') + '::';
    mAll.set(thiskey, mAll.has(thiskey) ? mAll.get(thiskey).concat(val) : [val]);
});
for (var _i = 0, _a = Array.from(mAll.entries()); _i < _a.length; _i++) {
    var _b = _a[_i], key = _b[0], vals = _b[1];
    mLatest.set(key, vals[vals.length - 1]);
}
var levelup = require("levelup");
exports.db = levelup('./mydbv2');
function fix(s) {
    return s.replace('ammy', 'Zok4J4riZWgWNhKQ');
}
Array.from(mLatest.entries()).forEach(function (_a) {
    var k = _a[0], v = _a[1];
    return exports.db.put('cu::' + fix(k), fix(v));
});
for (var _c = 0, _d = Array.from(mAll.entries()); _c < _d.length; _c++) {
    var _e = _d[_c], k = _e[0], vs = _e[1];
    for (var _f = 0, vs_1 = vs; _f < vs_1.length; _f++) {
        var v = vs_1[_f];
        var o = JSON.parse(v);
        exports.db.put('hi::' + fix(k) + o.createdAt, fix(v));
    }
}
// Make sure all data was committed! Node might conceivably exit before level finishes? 
//# sourceMappingURL=updateDb.js.map