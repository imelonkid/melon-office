import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script = fs.readFileSync(new URL('../site/assets/download-v1.js', import.meta.url), 'utf8');
const fallback = 'https://github.com/imelonkid/melon-office/releases/latest';
const installer = 'https://melon-download.oss-cn-beijing.aliyuncs.com/melon-office/desktop/MelonOffice-0.3.0-universal.dmg';

function run(fetch, timers = { setTimeout, clearTimeout }) {
  const link = { href: fallback };
  const document = { getElementById(id) { assert.equal(id, 'download'); return link; } };
  const done = vm.runInNewContext(script, { document, fetch, URL, AbortController, ...timers });
  return { link, done };
}

test('the download link uses the latest OSS universal installer after a successful HEAD', async () => {
  const calls = [];
  const { link, done } = run(async (url, options) => {
    calls.push([url, options]);
    return calls.length === 1 ? { ok: true, json: async () => ({ files: { arm64: installer } }) } : { ok: true };
  });
  assert.equal(link.href, fallback);
  await done;
  assert.equal(link.href, installer);
  assert.equal(calls[0][0], 'https://melon-download.oss-cn-beijing.aliyuncs.com/melon-office/desktop/latest.json');
  assert.equal(calls[0][1].cache, 'no-cache');
  assert.equal(calls[1][0], installer);
  assert.equal(calls[1][1].method, 'HEAD');
  assert.equal(calls[0][1].signal, calls[1][1].signal);
});

test('invalid manifest fields or installer URLs keep GitHub and never probe the target', async () => {
  for (const value of [undefined, null, {}, { files: { arm64: [installer] } }, ...[
    'not a URL', 'javascript:alert(1)', installer.replace('https:', 'http:'),
    installer.replace('melon-download.oss-cn-beijing.aliyuncs.com', 'example.com'),
    installer.replace('/melon-office/', '/drip/'), installer.replace('.dmg', '.html'),
    installer.replace('https://', 'https://user:password@'),
  ].map((arm64) => ({ files: { arm64 } }))]) {
    let calls = 0;
    const { link, done } = run(async () => {
      assert.equal(++calls, 1, 'invalid targets must not be requested');
      return { ok: true, json: async () => value };
    });
    await done;
    assert.equal(link.href, fallback);
  }
});

test('unavailable metadata, malformed JSON, network failures and missing installers keep GitHub', async () => {
  const scenarios = [
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } }),
    async () => { throw new TypeError('network or CORS failure'); },
    async (_, options) => options.method === 'HEAD' ? { ok: false } : { ok: true, json: async () => ({ files: { arm64: installer } }) },
    async (_, options) => {
      if (options.method === 'HEAD') throw new TypeError('installer unreachable');
      return { ok: true, json: async () => ({ files: { arm64: installer } }) };
    },
  ];
  for (const fetch of scenarios) {
    const { link, done } = run(fetch);
    await done;
    assert.equal(link.href, fallback);
  }
});

test('the five-second timeout aborts the lookup and retains GitHub', async () => {
  let expire, cleared = false;
  const { link, done } = run((_, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }), {
    setTimeout(callback, delay) { assert.equal(delay, 5000); expire = callback; return 1; },
    clearTimeout(id) { assert.equal(id, 1); cleared = true; },
  });
  expire();
  await done;
  assert.equal(link.href, fallback);
  assert.equal(cleared, true);
});
