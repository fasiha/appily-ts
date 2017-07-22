const fetch = typeof window === 'undefined' ? require('node-fetch') : window.fetch;

export function concatMap<T, U>(arr: T[], f: (x: T) => U[]): U[] {
    let ret = [];
    for (let x of arr) {
        ret = ret.concat(f(x));
    }
    return ret;
}

export function any(arr: boolean[]) { return arr.reduce((prev, curr) => prev || curr, false); }

export function all(arr: boolean[]) { return arr.reduce((prev, curr) => prev && curr, true); }

export function elapsedHours(d: Date, dnow?: Date) {
    return (((dnow || new Date()) as any) - (d as any)) / 3600e3 as number
};

export function endsWith(big: string, little: string): boolean {
    if (big.length < little.length) {
        return false;
        // We do this because if we just relied on lastIndexOf and compared it to difference of lengths, -1 might turn up
    }
    return big.lastIndexOf(little) === (big.length - little.length);
}

export function dedupeViaSets<T>(arr: T[]): T[] {
    let ret: T[] = [];
    let retset: Set<T> = new Set([]);
    for (const x of arr) {
        if (!retset.has(x)) {
            ret.push(x);
            retset.add(x);
        }
    }
    return ret;
}

export async function uncachedUrlFetch(url: string) {
    return (await fetch(url)).text();
}

// Don’t drag `btoa` and `atob` node modules into Browserify builds. Not sure if this is wise.
const mybtoa = typeof window === 'undefined' ? require('btoa') : window.btoa;
const myatob = typeof window === 'undefined' ? require('atob') : window.atob;

// Use encodeURI instead of encodeURIComponent since we just need ASCII. The latter will unnecessarily encode +, @, =, etc.
export function utoa(unicode: string): string {
    return mybtoa(encodeURI(unicode));
}

export function atou(ascii: string): string {
    return decodeURI(myatob(ascii));
}