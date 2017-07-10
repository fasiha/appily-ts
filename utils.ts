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