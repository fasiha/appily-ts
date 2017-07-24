import { VNode } from '@cycle/dom';
import { FactUpdate } from "./storageServer";

export interface WhatToQuizInfo {
    prob: number;
    update: FactUpdate;
    risky: boolean;
    startTime: Date;
    quizInfo?: any;
    docId?: string;
    // allRelatedUpdates?: FactUpdate[];
    // factId?: string;
};

export interface FactDbCycle {
    stripFactIdOfSubfact: (factId: string) => string;
    factToFactIds: (fact: any) => string[];
    makeDOMStream: MakeDOMStreamFunction;
};

export interface CycleSources {
    DOM: any;
    quiz: any;
    known: any;
}
export interface CycleSinks {
    DOM: any;
    learned: any;
    quizzed: any;
}
export type MakeDOMStreamFunction = (source: CycleSources) => CycleSinks;

export interface WhatToLearnInfo {
    fact: any;
    docId: string;
}
