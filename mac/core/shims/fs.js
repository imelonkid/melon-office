// the bit of node:fs that hooks-config.mjs uses, backed by FileManager in the app
const existsSync = (p) => native.fileExists(p);
const readFileSync = (p) => native.readFile(p);
const writeFileSync = (p, data) => native.writeFile(p, String(data));
const mkdirSync = (p) => native.mkdirp(p);
const copyFileSync = (a, b) => native.copyFile(a, b);
export default { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync };
