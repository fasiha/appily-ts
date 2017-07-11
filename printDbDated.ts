import { db } from "./diskDb";
import { collectKefirStream, leveldbToStream } from "./storageServer";

const key2timestamp = s => s.split('::')[3];
collectKefirStream(leveldbToStream(db))
    .then(arr => arr.sort((a, b) => +(key2timestamp(a.key) > key2timestamp(b.key)))
        .forEach(x => console.log(x.key + '→' + x.value)));
