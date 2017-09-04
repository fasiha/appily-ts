"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function parseBracketedFormat(s, inner) {
    var pieces = [];
    while (1) {
        // Search for non-link prefix. If found, strip it.
        var plain = s.match(/^[^\[]+/);
        if (plain) {
            pieces.push(plain[0]);
            s = s.slice(plain[0].length);
        }
        // Guaranteed that the first character is either `[something in brackets]` or empty.
        var furi = s.match(inner);
        if (!furi) {
            break;
        }
        pieces.push({ ruby: furi[1], rt: furi[2] });
        s = s.slice(furi[0].length);
    }
    return pieces;
}
function parseJmdictFurigana(s) {
    // Like `[言;い]う`, per JmdictFurigana project
    return parseBracketedFormat(s, /^\[([^;]+);([^\]]+)\]/);
}
exports.parseJmdictFurigana = parseJmdictFurigana;
function parseMarkdownLinkRuby(s) {
    // Converts my "fake" Ruby syntax using Markdown links: `a[b](c)d`.
    return parseBracketedFormat(s, /^\[([^\]]+)\]\(([^)]+)\)/);
}
exports.parseMarkdownLinkRuby = parseMarkdownLinkRuby;
function furiganaStringToPlain(arr) {
    return arr.map(function (o) { return typeof (o) === 'string' ? o : o.ruby; }).join('');
}
exports.furiganaStringToPlain = furiganaStringToPlain;
function furiganaStringToReading(arr) {
    return arr.map(function (o) { return typeof (o) === 'string' ? o : o.rt; }).join('');
}
exports.furiganaStringToReading = furiganaStringToReading;
//# sourceMappingURL=ruby.js.map