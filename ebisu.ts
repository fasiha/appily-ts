export const ebisu: Ebisu = require("ebisu-js");
export type EbisuObject = Array<number>;
interface Ebisu {
    defaultModel(t: number, a?: number, b?: number): EbisuObject;
    predictRecall(o: EbisuObject, tnow: number): number;
    updateRecall(o: EbisuObject, result: boolean, tnow: number): EbisuObject;
}
