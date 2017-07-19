import { FactUpdate, FactDb } from "./storageServer";
import { EbisuObject, ebisu } from "./ebisu";
import { cliPrompt, endsWith, elapsedHours } from "./utils";
import { furiganaStringToReading, parseMarkdownLinkRuby, furiganaStringToPlain, Furigana, Ruby } from "./ruby";
import { WEB_URL, Fact, HowToQuizInfo, toponyms } from "./toponyms";
import { FactDbCli, SubmitFunction, DoneQuizzingFunction } from "./cliInterface";

const newlyLearned = ebisu.defaultModel(0.25, 2.5);
const buryForever = ebisu.defaultModel(Infinity);

function factIdToURL(s: string) {
    return `${WEB_URL}#${encodeURI(toponyms.stripFactIdOfSubfact(s))}`;
}

export const toponymsCli: FactDbCli = { administerQuiz, findAndLearn, stripFactIdOfSubfact: toponyms.stripFactIdOfSubfact };

async function findAndLearn(submit: SubmitFunction, knownFactIds: string[]) {
    const fact: Fact = await toponyms.whatToLearn(knownFactIds);
    if (fact) {
        let factIds: string[] = toponyms.factToFactIds(fact);

        console.log(`Hey! Learn this:`);
        console.log(fact);
        console.log(factIdToURL(factIds[0]));
        console.log('http://jisho.org/search/%23kanji%20' + encodeURI(fact
            .filter((f: Furigana) => typeof (f) !== 'string')
            .map((f: Ruby) => f.ruby).join('')));
        console.log('Hit Enter when you got it. (Control-C to quit without committing to learn this.)');
        var start = new Date();
        var typed = await cliPrompt();
        factIds.forEach(factId => submit(factId, newlyLearned, { firstLearned: true, hoursWaited: elapsedHours(start) }));
    } else {
        console.log(`No new facts to learn. Go outside and play!`)
    }
}

// export async function administerQuiz(doneQuizzing:DoneQuizzingFunction, factId: string, allUpdates: FactUpdate[]) {

async function administerQuiz(doneQuizzing: DoneQuizzingFunction, factId: string, allUpdates: FactUpdate[]) {
    console.log(`¡¡¡🎆 QUIZ TIME 🎇!!!`);
    let quiz: HowToQuizInfo = await toponyms.howToQuiz(factId);
    let fact = quiz.fact;
    const alpha = 'ABCDEFGHIJKLM'.split('');

    let info;
    let result;
    let start = new Date();
    if (factId.indexOf('-kanji') >= 0) {
        let confusers = quiz.confusers;

        console.log(`What’s the kanji for: ${furiganaStringToReading(fact)}?`);
        confusers.forEach((fact, idx: number) => console.log(`${alpha[idx]}. ${furiganaStringToPlain(fact)}`));

        let responseText = await cliPrompt();

        let responseIdx = alpha.indexOf(responseText.toUpperCase());
        if (responseIdx < 0 || responseIdx >= confusers.length) {
            console.log('Ummm… you ok?');
            return;
        }
        result = furiganaStringToPlain(confusers[responseIdx]) === furiganaStringToPlain(fact);
        info = {
            result,
            response: furiganaStringToPlain(confusers[responseIdx]),
            confusers: confusers.map(furiganaStringToPlain)
        };
    } else {
        console.log(`What’s the reading for: ${furiganaStringToPlain(fact)}`);
        let responseText = await cliPrompt();
        result = responseText === furiganaStringToReading(fact);
        info = { result, response: responseText };
    }
    info.hoursWaited = elapsedHours(start);

    await doneQuizzing(factId, allUpdates, info);

    if (result) { console.log('✅✅✅!'); }
    else { console.log('❌❌❌', fact); }
}
