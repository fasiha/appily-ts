import { db } from "./diskDb";
import { collectKefirStream, leveldbToStream } from "./storageServer";

const key2timestamp = s => new Date(s.split('::')[3]) as any;
collectKefirStream(leveldbToStream(db))
    .then(arr => arr.sort((a, b) => key2timestamp(a.key) - key2timestamp(b.key))
        .forEach(x => console.log(x.key + '→' + x.value)));
