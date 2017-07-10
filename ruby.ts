export interface Ruby {
    ruby: string;
    rt: string;
}
export type Furigana = Ruby | string;

function parseBracketedFormat(s: string, inner: RegExp): Furigana[] {
    var pieces: Furigana[] = [];
    while (1) {
        // Search for non-link prefix. If found, strip it.
        let plain = s.match(/^[^\[]+/);
        if (plain) {
            pieces.push(plain[0]);
            s = s.slice(plain[0].length);
        }
        // Guaranteed that the first character is either `[something in brackets]` or empty.
        let furi = s.match(inner);
        if (!furi) { break; }
        pieces.push({ ruby: furi[1], rt: furi[2] });
        s = s.slice(furi[0].length);
    }
    return pieces;
}

export function parseJmdictFurigana(s: string): Furigana[] {
    // Like `[言;い]う`, per JmdictFurigana project
    return parseBracketedFormat(s, /^\[([^;]+);([^\]]+)\]/);
}

export function parseMarkdownLinkRuby(s: string): Furigana[] {
    // Converts my "fake" Ruby syntax using Markdown links: `a[b](c)d`.
    return parseBracketedFormat(s, /^\[([^\]]+)\]\(([^)]+)\)/);
}
export function furiganaStringToPlain(arr: Furigana[]): string {
    return arr.map(o => typeof (o) === 'string' ? o : o.ruby).join('');
}

export function furiganaStringToReading(arr: Furigana[]): string {
    return arr.map(o => typeof (o) === 'string' ? o : o.rt).join('');
}