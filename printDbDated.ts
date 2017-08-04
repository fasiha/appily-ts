import levelup = require("levelup");
import { leveldbToStream } from "./storageServer";
import { xstreamToPromise } from "./utils";

const db: levelup.LevelUpBase<levelup.Batch> = levelup('./mydb');

const key2timestamp = s => new Date(JSON.parse(s).createdAt) as any;
xstreamToPromise(leveldbToStream(db))
    .then(arr => arr.sort((a, b) => (key2timestamp(a.value) - key2timestamp(b.value)) || +(a.key < b.key))
        .forEach(x => console.log(x.key + '→' + x.value)));
// The comparator diffs timestamps, and if those are equal, I'd like to see the 'hi'storic rows *before* the 'cu'rrent rows.