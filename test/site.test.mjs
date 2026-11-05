import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('../site/', import.meta.url));

test('the deployable page resolves all local HTML and CSS assets inside site/', () => {
  const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  const asset = (owner, url) => {
    if (/^(?:https?:|data:|#)/.test(url)) return;
    const file = path.resolve(path.dirname(owner), url.split(/[?#]/)[0]);
    assert.ok(file.startsWith(site), 'page may not depend on files outside its deployed directory');
    assert.ok(fs.statSync(file).isFile(), `missing page asset: ${url}`);
    if (file.endsWith('.css')) for (const match of fs.readFileSync(file, 'utf8').matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) asset(file, match[1]);
  };
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) asset(path.join(site, 'index.html'), match[1]);
});

test('page language switching works without a server, module loader or network globals', () => {
  let click;
  const language = { addEventListener: (_, handler) => { click = handler; }, setAttribute() {}, textContent: '' };
  const headline = { dataset: { zh: '我的 AI 员工，', en: 'You hired AI.' }, textContent: '我的 AI 员工，' };
  const officePreview = { removeAttribute() {}, pause() {} };
  const document = { documentElement: { lang: 'zh-CN' }, getElementById: (id) => id === 'office-preview' ? officePreview : language, querySelectorAll: () => [headline], title: '' };
  vm.runInNewContext(fs.readFileSync(path.join(site, 'assets/hero-v2.js'), 'utf8'), { document, matchMedia: () => ({ matches: false }) });
  click();
  assert.equal(headline.textContent, 'You hired AI.');
  assert.equal(document.documentElement.lang, 'en');
  click();
  assert.equal(headline.textContent, '我的 AI 员工，');
  assert.equal(document.documentElement.lang, 'zh-CN');
});

test('reduced motion disables autoplay and pauses the office video', () => {
  let removed, paused = false;
  const video = { removeAttribute(name) { removed = name; }, pause() { paused = true; } };
  const language = { addEventListener() {} };
  const document = { getElementById: (id) => id === 'office-preview' ? video : language };
  vm.runInNewContext(fs.readFileSync(path.join(site, 'assets/hero-v2.js'), 'utf8'), { document, matchMedia: () => ({ matches: true }) });
  assert.equal(removed, 'autoplay');
  assert.equal(paused, true);
});
