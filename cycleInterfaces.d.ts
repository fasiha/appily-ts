import xs, { MemoryStream } from 'xstream';
import { VNode } from '@cycle/dom';
import { DocParams, FactUpdate } from "./storageServer";

export interface WhatToQuizInfo {
    prob: number;
    update: FactUpdate;
    risky: boolean;
    startTime: Date;
    howToQuiz?: any;
    docId?: string;
    // allRelatedUpdates?: FactUpdate[];
    // factId?: string;
}

export interface FactDbCycle {
    stripFactIdOfSubfact: (factId: string) => string;
    factToFactIds: (fact: any) => string[];
    makeDOMStream: MakeDOMStreamFunction;
}

export interface CycleSources {
    DOM: any;
    quiz: any;
    known: MemoryStream<string[]>;
    params: xs<DocParams>;
}
export interface CycleSinks {
    DOM: any;
    learned: any;
    quizzed: xs<[any, WhatToQuizInfo, any]>;
}
export type MakeDOMStreamFunction = (source: CycleSources) => CycleSinks;

export interface WhatToLearnInfo {
    fact: any;
    docId: string;
}
