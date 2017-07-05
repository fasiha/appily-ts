import fetch from "node-fetch";
import { parseFakeRuby, furiganaStringToPlain, Furigana } from "./ruby";

var RUBY_START = '- Ruby: ';

export async function urlToFuriganas(url: string): Promise<Array<Furigana[]>> {
    var req = await fetch(url);
    var text: string = await req.text();
    var rubyLines: string[] = text.split('\n').filter(s => s.indexOf(RUBY_START) === 0).map(s => s.slice(RUBY_START.length));
    var furiganas = rubyLines.map(parseFakeRuby);
    return furiganas;
}

export function furiganaFactToFactIds(word: Furigana[]) {
    let plain = furiganaStringToPlain(word);
    return [`${plain}-kanji`, `${plain}-reading`];
}

// urlToFuriganas("https://raw.githubusercontent.com/fasiha/toponyms-and-nymes/gh-pages/README.md").then(x => {
//     console.log("Juicy", x);
//     console.log("SUPER-JUICY!");
//     console.log(x.map(furiganaStringToPlain));
// })