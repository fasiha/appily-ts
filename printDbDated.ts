import { db } from "./diskDb";
import { leveldbToStream } from "./storageServer";
import { xstreamToPromise } from "./utils";

const key2timestamp = s => new Date(s.split('::')[3]) as any;
xstreamToPromise(leveldbToStream(db))
    .then(arr => arr.sort((a, b) => key2timestamp(a.key) - key2timestamp(b.key))
        .forEach(x => console.log(x.key + '→' + x.value)));
