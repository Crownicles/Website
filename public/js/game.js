/**
 * Game simulation – card-based UI with map & travel animation.
 */

import { t, getLocale } from './i18n.js';

const DISCORD_INVITE = 'https://discord.gg/WwgBfSg';
const TYPING_DELAY = 700;

/* Map image URLs from the Crownicles CDN */
const MAP_CURSOR_URL = (lang, locId) =>
  `https://crownicles.com/public/ressources/mapsCursed/${lang}_${locId}_map.jpg`;

/* The two locations used in the demo */
const LOCATIONS = [
  { id: 4, key: 'oldsterForest' },  // Oldster Forest
  { id: 6, key: 'bougCoton' },      // Boug-Coton (village)
];

let currentStep = 0; // 0=welcome, 1=event0, 2=travel, 3=event1, 4=final
let events = [];
let overlay, container;

/* ---- Overlay lifecycle ---- */
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
  currentStep = 0;
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

/* ---- Progress bar: welcome → event 1 → travel → event 2 → final ---- */
function progressHTML() {
  const steps = 5;
  return `<div class="game-progress">${Array.from({ length: steps }, (_, i) => {
    let cls = 'game-progress__dot';
    if (i < currentStep) cls += ' game-progress__dot--done';
    else if (i === currentStep) cls += ' game-progress__dot--active';
    return `<div class="${cls}"></div>`;
  }).join('')}</div>`;
}

/* ---- Map widget ---- */
function mapHTML(locId, label) {
  const lang = getLocale();
  const src = MAP_CURSOR_URL(lang, locId);
  return `
    <div class="game-map">
      <div class="game-map__label">📍 ${t('game.locationLabel')}: <strong>${label}</strong></div>
      <img class="game-map__img" src="${src}" alt="Map – ${label}">
    </div>`;
}

/* ---- Step: Welcome ---- */
function renderWelcome() {
  currentStep = 0;
  const loc = LOCATIONS[0];
  const locName = t(`game.locations.${loc.key}`);

  container.innerHTML = `
    ${progressHTML()}
    ${mapHTML(loc.id, locName)}
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

/* ---- Step: Event ---- */
function renderEvent(index) {
  currentStep = index === 0 ? 1 : 3;
  const ev = events[index];
  if (!ev) { renderFinal(); return; }

  const loc = LOCATIONS[index];
  const locName = t(`game.locations.${loc.key}`);

  container.innerHTML = `
    ${progressHTML()}
    ${mapHTML(loc.id, locName)}
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

/* ---- Handle choice & show outcome ---- */
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
        ${t('game.nextEvent')} →
      </button>
    `;
    result.after(actions);

    actions.querySelector('#game-next').addEventListener('click', () => {
      if (isLast) {
        renderFinal();
      } else {
        renderTravel();
      }
    });

    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, TYPING_DELAY);
}

/* ---- Step: Travel animation ---- */
function renderTravel() {
  currentStep = 2;
  const from = LOCATIONS[0];
  const to = LOCATIONS[1];
  const fromName = t(`game.locations.${from.key}`);
  const toName = t(`game.locations.${to.key}`);
  const lang = getLocale();

  container.innerHTML = `
    ${progressHTML()}
    <div class="game-travel">
      <div class="game-travel__header">
        <span class="game-travel__icon">🗺️</span>
        <span class="game-travel__title">${t('game.travelTitle')}</span>
      </div>
      <div class="game-travel__text">${t('game.travelText', { from: fromName, to: toName })}</div>
      <div class="game-travel__map-wrapper">
        <img class="game-travel__map game-travel__map--from"
             src="${MAP_CURSOR_URL(lang, from.id)}"
             alt="Map – ${fromName}">
        <img class="game-travel__map game-travel__map--to"
             src="${MAP_CURSOR_URL(lang, to.id)}"
             alt="Map – ${toName}"
             style="opacity:0;">
      </div>
      <div class="game-travel__progress">
        <div class="game-travel__bar">
          <div class="game-travel__bar-fill" id="travel-fill"></div>
        </div>
        <div class="game-travel__locations">
          <span>${fromName}</span>
          <span>${toName}</span>
        </div>
      </div>
    </div>
  `;

  // Animate the travel
  const fill = container.querySelector('#travel-fill');
  const fromImg = container.querySelector('.game-travel__map--from');
  const toImg = container.querySelector('.game-travel__map--to');

  requestAnimationFrame(() => {
    fill.style.width = '100%';
  });

  // Cross-fade maps at 50%
  setTimeout(() => {
    fromImg.style.opacity = '0';
    toImg.style.opacity = '1';
  }, 1500);

  // Show arrival after animation completes
  setTimeout(() => {
    const arrived = document.createElement('div');
    arrived.className = 'game-travel__arrived';
    arrived.innerHTML = `
      <div class="game-travel__arrived-text">📍 ${t('game.travelArrived', { location: toName })}</div>
      <button class="btn btn--primary btn--small" id="travel-continue">${t('game.nextEvent')} →</button>
    `;
    container.querySelector('.game-travel').appendChild(arrived);

    container.querySelector('#travel-continue').addEventListener('click', () => {
      renderEvent(1);
    });
  }, 3200);
}

/* ---- Step: Final CTA ---- */
function renderFinal() {
  currentStep = 4;
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
