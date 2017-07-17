import { VNode } from '@cycle/dom';
import { FactUpdate } from "./storageServer";

export interface HowToQuizInfo {
    prob: number;
    update: FactUpdate;
    risky: boolean;
    quizInfo?: any;
    allRelatedUpdates?: FactUpdate[];
    factId?: string;
    startTime?: Date;
};


export interface FactDbCycle {
    whatToLearn: (USER: string, DOCID: string, knownFactIds: string[]) => Promise<any>;
    checkAnswer: (db, USER: string, [answer, quiz]: [number | string, HowToQuizInfo]) => VNode;
    quizToDOM: (quiz: HowToQuizInfo) => VNode;
    howToQuiz: (USER: string, DOCID: string, factId: string, allUpdates: FactUpdate[]) => Promise<HowToQuizInfo>
    stripFactIdOfSubfact: (factId: string) => string;
    newFactToDom: (fact: any) => VNode;
    factToFactIds: (fact: any) => string[];
};

export interface WhatToLearnInfo {
    fact: any;
    docId: string;
}
