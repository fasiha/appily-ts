import xs, { MemoryStream } from 'xstream';
import { VNode } from '@cycle/dom';
import { DoctypeParams, FactUpdate } from "./storageServer";

export interface WhatToQuizInfo {
    prob: number;
    update: FactUpdate;
    risky: boolean;
    startTime: Date;
    quizInfo?: any;
    docId?: string;
    // allRelatedUpdates?: FactUpdate[];
    // factId?: string;
}

export interface FactDbCycle {
    setup: (inputs: string[]) => Promise<any>;
    stripFactIdOfSubfact: (factId: string) => string;
    factToFactIds: (fact: any) => string[];
    makeDOMStream: MakeDOMStreamFunction;
}

export interface CycleSources {
    DOM: any;
    quiz: any;
    known: MemoryStream<string[]>;
    params: xs<DoctypeParams>;
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
