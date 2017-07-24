import { EbisuObject } from "./ebisu";
import { WhatToQuizInfo } from "./cycleInterfaces";
import { FactUpdate } from "./storageServer";
export interface SubmitToServer {
    docId: string;
    factId: string;
    ebisuObject: EbisuObject;
    updateObject: any;
}

export interface MostForgottenToServer {
    soleDocId: string;
}
export interface MostForgottenFromServer {
    prob: number;
    update: FactUpdate;
}

export interface KnownFactIdsToServer {
    docId: string;
}
export type KnownFactIdsFromServer = string[];

export interface DoneQuizzingToServer {
    docId: string;
    activelyQuizzedFactId: string;
    allQuizzedFactIds: string[];
    infos: any[];
}