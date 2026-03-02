/**
 * Main entry point for the Crownicles landing page.
 */

import { initI18n, t, getLocale, getNextLocale, loadTranslations } from './i18n.js';
import { openGame, closeGame } from './game.js';

const GUIDE_URL = 'https://guide.crownicles.com';

async function init() {
  await initI18n();
  render();
  bindEvents();
}

function render() {
  document.title = t('meta.title');
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.setAttribute('content', t('meta.description'));

  // Translate data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  // Language toggle
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    const next = getNextLocale();
    langBtn.textContent = next.toUpperCase();
    langBtn.setAttribute('aria-label', `Switch to ${next}`);
  }

  // Footer
  const footer = document.getElementById('footer-text');
  if (footer) {
    footer.innerHTML = `${t('footer.copyright', { year: new Date().getFullYear() })} · ${t('footer.credits')} <a href="https://behance.net/mw3y" target="_blank" rel="noopener">MΛX</a> · ${t('footer.backgroundCredits')} <a href="https://www.freepik.com/free-vector/medieval-castle-interior-flat-cartoon-composition-with-king-throne-armed-knight-coat-arms-guard_6845842.htm" target="_blank" rel="noopener">macrovector</a>`;
  }
}

function bindEvents() {
  document.getElementById('btn-get-started')?.addEventListener('click', () => openGame());
  document.getElementById('btn-learn-more')?.addEventListener('click', () => {
    window.open(GUIDE_URL, '_blank', 'noopener');
  });

  document.getElementById('lang-toggle')?.addEventListener('click', async () => {
    await loadTranslations(getNextLocale());
    render();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const ov = document.getElementById('game-overlay');
      if (ov?.classList.contains('game-overlay--active')) closeGame();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
