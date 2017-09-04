"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function concatMap(arr, f) {
    var ret = [];
    for (var _i = 0, arr_1 = arr; _i < arr_1.length; _i++) {
        var x = arr_1[_i];
        ret = ret.concat(f(x));
    }
    return ret;
}
exports.concatMap = concatMap;
function any(arr) { return arr.reduce(function (prev, curr) { return prev || curr; }, false); }
exports.any = any;
function all(arr) { return arr.reduce(function (prev, curr) { return prev && curr; }, true); }
exports.all = all;
function cliPrompt() {
    return new Promise(function (resolve, reject) {
        var stdin = process.stdin, stdout = process.stdout;
        stdin.resume();
        stdout.write('> ');
        stdin.once('data', function (data) {
            resolve(data.toString().trim());
            stdin.pause();
        });
    });
}
exports.cliPrompt = cliPrompt;
function elapsedHours(d, dnow) {
    return ((dnow || new Date()) - d) / 3600e3;
}
exports.elapsedHours = elapsedHours;
;
function endsWith(big, little) {
    if (big.length < little.length) {
        return false;
        // We do this because if we just relied on lastIndexOf and compared it to difference of lengths, -1 might turn up
    }
    return big.lastIndexOf(little) === (big.length - little.length);
}
exports.endsWith = endsWith;
function dedupeViaSets(arr) {
    var ret = [];
    var retset = new Set([]);
    for (var _i = 0, arr_2 = arr; _i < arr_2.length; _i++) {
        var x = arr_2[_i];
        if (!retset.has(x)) {
            ret.push(x);
            retset.add(x);
        }
    }
    return ret;
}
exports.dedupeViaSets = dedupeViaSets;
function xstreamToPromise(x) {
    return new Promise(function (resolve, reject) {
        x.fold(function (acc, t) { return acc.concat(t instanceof Array ? [t] : t); }, [])
            .last()
            .addListener({
            next: function (final) { return resolve(final); },
            error: function (err) { return reject(err); },
            complete: function () { }
        });
    });
}
exports.xstreamToPromise = xstreamToPromise;
function flatten1(v) {
    return v.reduce(function (prev, curr) { return prev.concat(curr); }, v, []);
}
exports.flatten1 = flatten1;
//# sourceMappingURL=utils.js.map