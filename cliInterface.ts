import { FactUpdate } from "./storageServer";
import { EbisuObject } from "./ebisu";
export type SubmitFunction = (factId: string, ebisuObject: EbisuObject, updateObject: any) => Promise<void>;
export type DoneQuizzingFunction = (factId: string, allUpdates: FactUpdate[], info: any) => Promise<void>;
export interface FactDbCli {
    findAndLearn: (submit: SubmitFunction, knownFactIds: string[]) => Promise<void>;
    administerQuiz: (doneQuizing: DoneQuizzingFunction, factId: string, allRelatedUpdates: FactUpdate[]) => Promise<void>;
    stripFactIdOfSubfact: (factId: string) => string;
}