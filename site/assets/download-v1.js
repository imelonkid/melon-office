// Keep the HTML's GitHub Release link unless OSS provides a valid, reachable installer.
async function resolveDownload() {
  const base = 'https://melon-download.oss-cn-beijing.aliyuncs.com/melon-office/desktop/';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${base}latest.json`, { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) return null;
    const manifest = await response.json();
    if (typeof manifest?.files?.arm64 !== 'string') return null;
    const url = new URL(manifest.files.arm64);
    if (url.origin !== new URL(base).origin || url.username || url.password ||
        !url.pathname.startsWith('/melon-office/desktop/') || !url.pathname.endsWith('.dmg')) return null;
    const installer = await fetch(url.href, { method: 'HEAD', cache: 'no-cache', signal: controller.signal });
    return installer.ok ? url.href : null;
  } catch {
    // Network, CORS, timeout or invalid metadata: the existing Release link remains usable.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

resolveDownload().then((url) => {
  if (url) document.getElementById('download').href = url;
});
