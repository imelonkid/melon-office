const officePreview = document.getElementById('office-preview');
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  officePreview.removeAttribute('autoplay');
  officePreview.pause();
}

// Static presentation only: no scene loop, user data or service connections.
let lang = 'zh';
const language = document.getElementById('language');
language.addEventListener('click', () => {
  lang = lang === 'zh' ? 'en' : 'zh';
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-zh]').forEach((node) => {
    node.textContent = node.dataset[lang].split('\\n').join('\n');
  });
  language.textContent = lang === 'zh' ? 'EN' : '中';
  language.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换为中文');
  document.title = lang === 'zh' ? 'Melon Office — 我的 AI 员工，入职大厂了。' : 'Melon Office — You hired AI. Now take a break.';
});
