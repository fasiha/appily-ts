import { FactUpdate } from "./storageServer";
import { EbisuObject } from "./ebisu";
export type SubmitFunction = (user: string, docId: string, factId: string, ebisuObject: EbisuObject, updateObject: any) => Promise<void>;
export interface FactDbCli {
    administerQuiz: (db, USER: string, docId: string, factId: string, allRelatedUpdates: FactUpdate[]) => Promise<void>;
    stripFactIdOfSubfact: (factId: string) => string;
    findAndLearn: (submit: SubmitFunction, USER: string, DOCID: string, knownFactIds: string[]) => Promise<void>;
}