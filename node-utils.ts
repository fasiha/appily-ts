import { readFileSync, writeFile } from "fs";
import fetch from "node-fetch";
import xs from 'xstream';

export function cliPrompt(): Promise<string> {
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
