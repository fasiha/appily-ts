export interface Ruby {
    ruby: string;
    rt: string;
}
export type Furigana = Ruby | string;

// Converts my "fake" Markdownified Ruby syntax of `a[b](c)d`.
export function parseFakeRuby(s: string): Furigana[] {
    var pieces: Furigana[] = [];
    while (1) {
        // Search for non-link prefix. If found, strip it.
        let plain = s.match(/^[^\[]+/);
        if (plain) {
            pieces.push(plain[0]);
            s = s.slice(plain[0].length);
        }
        // Guaranteed that the first character is either `[a link like this]` or empty.
        let furi = s.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (!furi) { break; }
        pieces.push({ ruby: furi[1], rt: furi[2] });
        s = s.slice(furi[0].length);
    }
    return pieces;
}

export function furiganaStringToPlain(arr: Furigana[]): string {
    return arr.map(o => typeof (o) === 'string' ? o : o.ruby).join('');
}