import xs, { Stream } from 'xstream';
import run from '@cycle/run';
import { StateSource, pick, mix } from 'cycle-onionify';
import { div, button, p, makeDOMDriver, DOMSource, VNode } from '@cycle/dom';
import { HTTPSource } from '@cycle/http';

export interface State {
    status: boolean;
}

export type Reducer = (prev?: State) => State | undefined;

export type Sources = {
    DOM: DOMSource;
    HTTP: HTTPSource;
    onion: StateSource<State>;
}

export type Sinks = {
    DOM: Stream<VNode>;
    onion: Stream<Reducer>;
    HTTP: Stream<any>;
}

// export interface AddAction {
//     type: 'ADD',
//     payload: string;
// }

// export type Action = AddAction;

export default function Login(sources: Sources): Sinks {
    const defaultReducer$ = xs.of(function defaultReducer(prevState: State) {
        if (typeof prevState === 'undefined') {
            return { status: undefined };
        } else {
            return prevState;
        }
    }) as Stream<Reducer>;

    const updateReducer$ = sources.HTTP.select('ping')
        .flatten()
        .map(o => !o.unauthorized)
        .replaceError(e => xs.of(false))
        .map(bool => function updateReducer(prevState: State) {
            return { status: bool };
        }) as Stream<Reducer>;

    const reducer$ = xs.merge(updateReducer$, defaultReducer$);

    const state$ = sources.onion.state$;
    const vdom$ = state$.map((o: State) => {
        if (typeof o.status === 'undefined') {
            return p('Awaiting…')
        } else if (o.status) {
            return p('Logged in!')
        }
        return p('Logged out.')
    });

    const httpRequest$ = xs.of({ url: '/api/private', category: 'ping', method: 'GET' });

    return { DOM: vdom$, onion: reducer$, HTTP: httpRequest$ }

}