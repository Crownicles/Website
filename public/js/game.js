/**
 * Game simulation – simple card-based UI.
 */

import { t } from './i18n.js';

const DISCORD_INVITE = 'https://discord.gg/WwgBfSg';
const TYPING_DELAY = 700;

let currentIndex = 0;
let events = [];
let overlay, container;

function createOverlay() {
  overlay = document.createElement('div');
  overlay.className = 'game-overlay';
  overlay.id = 'game-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeGame();
  });

  container = document.createElement('div');
  container.className = 'game-container';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-modal', 'true');

  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

function openGame() {
  if (!overlay) createOverlay();
  events = t('game.events');
  currentIndex = 0;
  overlay.classList.add('game-overlay--active');
  document.body.style.overflow = 'hidden';
  renderWelcome();
}

function closeGame() {
  if (overlay) {
    overlay.classList.remove('game-overlay--active');
    document.body.style.overflow = '';
  }
}

function progressHTML() {
  const total = events.length || 4;
  return `<div class="game-progress">${Array.from({ length: total }, (_, i) => {
    let cls = 'game-progress__dot';
    if (i < currentIndex) cls += ' game-progress__dot--done';
    else if (i === currentIndex) cls += ' game-progress__dot--active';
    return `<div class="${cls}"></div>`;
  }).join('')}</div>`;
}

function renderWelcome() {
  container.innerHTML = `
    ${progressHTML()}
    <div class="game-card">
      <div class="game-card__icon">👑</div>
      <div class="game-card__title">${t('game.welcomeTitle')}</div>
      <div class="game-card__text">${t('game.welcomeText')}</div>
    </div>
    <div class="game-actions">
      <button class="btn btn--primary btn--small" id="game-start">${t('game.startButton')} →</button>
    </div>
  `;
  container.querySelector('#game-start').addEventListener('click', () => renderEvent(0));
}

function renderEvent(index) {
  currentIndex = index;
  const ev = events[index];
  if (!ev) { renderFinal(); return; }

  container.innerHTML = `
    ${progressHTML()}
    <div class="game-card">
      <div class="game-card__text">${ev.text}</div>
    </div>
    <div class="game-choices" id="choices">
      ${ev.choices.map((c, i) => `
        <button class="game-choice" data-i="${i}">
          <span>${c.emoji}</span>
          <span>${c.label}</span>
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.game-choice').forEach(btn => {
    btn.addEventListener('click', () => handleChoice(index, +btn.dataset.i));
  });
}

function handleChoice(evIdx, choiceIdx) {
  const choice = events[evIdx].choices[choiceIdx];

  container.querySelectorAll('.game-choice').forEach((btn, i) => {
    btn.classList.add('game-choice--disabled');
    if (i === choiceIdx) btn.classList.add('game-choice--selected');
  });

  const result = document.createElement('div');
  result.className = 'game-result';
  result.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
  container.querySelector('#choices').after(result);

  setTimeout(() => {
    result.innerHTML = `
      <div class="game-result__outcome">${choice.outcome}</div>
      <div class="game-result__reward">${choice.reward}</div>
    `;

    const actions = document.createElement('div');
    actions.className = 'game-actions';
    const isLast = evIdx >= events.length - 1;
    actions.innerHTML = `
      <button class="btn btn--primary btn--small" id="game-next">
        ${isLast ? t('game.continueAdventure') : t('game.nextEvent')} →
      </button>
    `;
    result.after(actions);

    actions.querySelector('#game-next').addEventListener('click', () => {
      isLast ? renderFinal() : renderEvent(evIdx + 1);
    });

    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, TYPING_DELAY);
}

function renderFinal() {
  container.innerHTML = `
    ${progressHTML()}
    <div class="game-final">
      <div class="game-final__icon">👑</div>
      <div class="game-final__title">${t('game.finalTitle')}</div>
      <div class="game-final__text">${t('game.finalText')}</div>
      <a href="${DISCORD_INVITE}" target="_blank" rel="noopener" class="btn btn--discord">
        <svg class="btn__icon" viewBox="0 0 71 55" fill="currentColor">
          <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9.2.2 0 0010.4 5C1.5 18.4-.9 31.4.3 44.3v.1a58.7 58.7 0 0017.7 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1A58.5 58.5 0 0070.3 44.3v-.1C71.7 29.5 67.8 16.6 60.2 5a.2.2 0 00-.1-.1zM23.7 36.3c-3.4 0-6.2-3.1-6.2-7s2.8-7 6.2-7 6.3 3.2 6.2 7-2.7 7-6.2 7zm23 0c-3.4 0-6.2-3.1-6.2-7s2.8-7 6.2-7 6.3 3.2 6.2 7-2.7 7-6.2 7z"/>
        </svg>
        ${t('game.joinDiscord')}
      </a>
    </div>
  `;
}

export { openGame, closeGame };
