import { readFileSync, writeFile } from "fs";
import fetch from "node-fetch";

export function concatMap<T, U>(arr: T[], f: (x: T) => U[]): U[] {
    let ret = [];
    for (let x of arr) {
        ret = ret.concat(f(x));
    }
    return ret;
}

export function any(arr: boolean[]) { return arr.reduce((prev, curr) => prev || curr, false); }

export function all(arr: boolean[]) { return arr.reduce((prev, curr) => prev && curr, true); }

export function prompt(): Promise<string> {
    return new Promise((resolve, reject) => {
        var stdin = process.stdin,
            stdout = process.stdout;
        stdin.resume();
        stdout.write('> ');
        stdin.once('data', data => {
            resolve(data.toString().trim());
            stdin.pause();
        });
    });
}

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

async function fetchAndSave(url: string, local: string) {
    let text: string = await (await fetch(url)).text();
    writeFile(local, text, (e) => true); // don't `await` the write! Return the fetched data immediately.
    return text
}

export async function cachedUrlFetch(url: string, loc: string): Promise<string> {
    let fetchEnd: boolean = true;
    let ret;
    try {
        // Slurp from disk: this is sync because the app isn't doing anything else here.
        ret = readFileSync(loc, 'utf8');
    } catch (e) {
        // Not found! Fetch from network (then save to disk behind the scenes).
        ret = await fetchAndSave(url, loc);
        fetchEnd = false;
    }
    // If we found it on disk, fetch from the network & save *in the background*!
    if (fetchEnd) {
        fetchAndSave(url, loc); // NO await here!
    }
    return ret;
}

export async function uncachedUrlFetch(url:string) {
    return (await fetch(url)).text();
}