"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var storageServer_1 = require("./storageServer");
var utils_1 = require("./utils");
var diskDb_1 = require("./diskDb");
var key2timestamp = function (s) { return new Date(JSON.parse(s).createdAt); };
utils_1.xstreamToPromise(storageServer_1.leveldbToStream(diskDb_1.db))
    .then(function (arr) { return arr.sort(function (a, b) { return (key2timestamp(a.value) - key2timestamp(b.value)) || +(a.key < b.key); })
    .forEach(function (x) { return console.log(x.key + '→' + x.value); }); });
// The comparator diffs timestamps, and if those are equal, I'd like to see the 'hi'storic rows *before* the 'cu'rrent rows. 
//# sourceMappingURL=printDbDated.js.map