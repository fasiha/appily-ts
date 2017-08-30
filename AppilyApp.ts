import xs, { Stream } from 'xstream';
import isolate from '@cycle/isolate';
import { a, div, span, input, button, ul, VNode, DOMSource } from '@cycle/dom';
import { HTTPSource, RequestOptions } from '@cycle/http';
import { StateSource, pick, mix } from 'cycle-onionify';

import { FactDbCycle } from "./cycleInterfaces";
import { UserParams, DocParams, FactUpdate } from "./storageServer";

import { toponymsCyclejs } from "./toponyms-cyclejs";
import { tono5kCyclejs } from "./tono5k-cyclejs";
import { scramblerCyclejs } from "./scrambler-cyclejs";
const docid2module: Map<string, FactDbCycle> = new Map([
    ["toponyms", toponymsCyclejs],
    ["tono5k", tono5kCyclejs],
    ["scrambler", scramblerCyclejs],
]);


interface LoggedIn {
    login: "true";
    docs: DocParams[];
    // mostForgotten: FactUpdate;
}
interface LoggedOut { login: "false" };
interface NotAsked { login: "notasked"; };
interface Asked { login: "asked" };
export type State =
    | LoggedIn
    | LoggedOut
    | NotAsked
    | Asked;

export type Reducer = (prev?: State) => State | undefined;

export type Sources = {
    DOM: DOMSource;
    onion: StateSource<State>;
    HTTP: HTTPSource;
}

export type Sinks = {
    DOM: Stream<VNode>;
    onion: Stream<Reducer>;
    HTTP: Stream<RequestOptions>;
}

export interface AddAction {
    type: 'ADD',
    payload: string;
}

export interface LoggedInAction {
    type: 'LOGIN',
    payload: DocParams[];
}

export interface LoggedOutAction {
    type: 'LOGOUT',
    payload: void;
}

export type Action = AddAction | LoggedInAction | LoggedOutAction;

function intent(domSource: DOMSource, http: HTTPSource): Stream<Action> {
    const domActions$ = domSource.select('.input').events('input')
        .map(inputEv => domSource.select('.add').events('click').mapTo(inputEv))
        .flatten()
        .map(inputEv => {
            return {
                type: 'ADD',
                payload: (inputEv.target as HTMLInputElement).value
            } as AddAction;
        });
    const userParams$: xs<UserParams> = http.select('params')
        .flatten()
        .map(res => res.body)
        .replaceError(e => xs.of(null));
    const httpActions$ = userParams$.map(b => b ? { type: 'LOGIN', payload: b.docs } as LoggedInAction : { type: 'LOGOUT' } as LoggedOutAction);
    return xs.merge(domActions$, httpActions$);
}

function model(action$: Stream<Action>): Stream<Reducer> {
    const initReducer$ = xs.of(function initReducer(prev?: State): State {
        return (typeof prev === 'undefined') ? { login: "notasked" } as NotAsked : prev;
    });

    const addReducer$ = action$
        .filter(ac => ac.type === 'ADD')
        .map(ac => function addReducer(prevState: State): State {
            return prevState;//{list: prevState.list.concat({ content: ac.payload }),};
        });
    const loginReducer$ = action$
        .filter(ac => ac.type === 'LOGIN')
        .map(ac => function loginReducer(prevState: State): State {
            const ret: LoggedIn = { docs: ac.payload as DocParams[], login: "true" };
            return ret;
        });
    const logoutReducer$ = action$
        .filter(ac => ac.type === 'LOGOUT')
        .map(ac => function loginReducer(prevState: State): State {
            const ret: LoggedOut = { login: "false" };
            return ret;
        });

    return xs.merge(initReducer$, addReducer$, loginReducer$, logoutReducer$);
}

function view(state$: Stream<State>): Stream<VNode> {
    return state$.map(state => {
        switch (state.login) {
            case 'true': return div([a({ attrs: { href: "/logout" } }, 'Logout'), div(JSON.stringify(state))]);
            case 'false': return a({ attrs: { href: "/auth/github" } }, 'Log in with GitHub!');
            case 'notasked': return div('not asked');
            case 'asked': return div('asking…');
        };
    });
}
function netview(state$: Stream<State>): Stream<RequestOptions> {
    return state$.map(state => {
        if (state.login === 'notasked') {
            return { url: '/api/userParams', category: 'params', method: 'GET' };
        }
    });
}

export default function AppilyApp(sources: Sources): Sinks {
    const state$ = sources.onion.state$;
    // const listSinks = isolate(List, 'list')(sources as any as ListSources);
    const action$ = intent(sources.DOM, sources.HTTP);
    const parentReducer$ = model(action$);
    // const listReducer$ = listSinks.onion as any as Stream<Reducer>;
    const reducer$ = xs.merge(parentReducer$);
    const vdom$ = view(state$);
    const vhttp$ = netview(state$);

    return {
        DOM: vdom$,
        onion: reducer$,
        HTTP: vhttp$
    }
}
