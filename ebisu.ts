import ebisujs = require("ebisu-js");
export type EbisuObject = Array<number>;

function defaultModel(t: number, a?: number, b?: number): EbisuObject {
    return ebisujs.defaultModel(t, a, b);
}
function predictRecall(o: EbisuObject, t: number): number {
    return ebisujs.predictRecall(o, t);
}
function updateRecall(o: EbisuObject, result: boolean, tnow: number): EbisuObject {
    return ebisujs.updateRecall(o, result, tnow);
}

interface Ebisu {
    defaultModel(t: number, a?: number, b?: number): EbisuObject;
    predictRecall(o: EbisuObject, t: number): number;
    updateRecall(o: EbisuObject, result: boolean, tnow: number): EbisuObject;
}

export var ebisu: Ebisu = { defaultModel, predictRecall, updateRecall };