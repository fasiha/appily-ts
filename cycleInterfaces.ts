import { VNode } from '@cycle/dom';
import { FactUpdate } from "./storageServer";

export interface WhatToQuizInfo {
    prob: number;
    update: FactUpdate;
    risky: boolean;
    quizInfo?: any;
    docId: string;
    allRelatedUpdates?: FactUpdate[];
    factId?: string;
    startTime?: Date;
};


export interface FactDbCycle {
    stripFactIdOfSubfact: (factId: string) => string;
    factToFactIds: (fact: any) => string[];
    makeDOMStream: any;
};

export interface WhatToLearnInfo {
    fact: any;
    docId: string;
}
