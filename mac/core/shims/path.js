// the bit of node:path (POSIX) that the server code uses
const basename = (p) => String(p).replace(/\/+$/, '').split('/').pop() || '';
const dirname = (p) => { const s = String(p).replace(/\/+$/, ''); const i = s.lastIndexOf('/'); return i > 0 ? s.slice(0, i) : i === 0 ? '/' : '.'; };
const join = (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/');
export default { basename, dirname, join };
export { basename, dirname, join };
