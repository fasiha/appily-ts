import levelup = require("levelup");
const assert = require('assert');
assert(process.argv.length >= 3 && process.argv[2].length > 0)

const db = levelup(process.argv[2]);
db.createReadStream().on('data', ({ key, value }) => console.log(`${key}→${value}`))