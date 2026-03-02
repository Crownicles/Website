/**
 * Game simulation – card-based UI with map & travel animation.
 */

import { t, getLocale } from './i18n.js';

const DISCORD_INVITE = 'https://discord.gg/WwgBfSg';
const TYPING_DELAY = 700;

/* The two locations used in the demo, with marker positions (% of map) */
const LOCATIONS = [
  { id: 1, key: 'sentinelBeach', x: 12.5, y: 5.2 },   // Sentinel Beach
  { id: 6, key: 'bougCoton',     x: 13.9, y: 35.3 },   // Boug-Coton
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

/* ---- Map widget with CSS marker ---- */
function mapHTML(locIndex) {
  const loc = LOCATIONS[locIndex];
  const label = t(`game.locations.${loc.key}`);
  return `
    <div class="game-map">
      <div class="game-map__label">📍 ${t('game.locationLabel')}: <strong>${label}</strong></div>
      <div class="game-map__container">
        <img class="game-map__img" src="./public/images/map.webp" alt="Map – ${label}">
        <div class="game-map__marker" style="left:${loc.x}%;top:${loc.y}%"></div>
      </div>
    </div>`;
}

/* ---- Step: Welcome ---- */
function renderWelcome() {
  currentStep = 0;
  container.innerHTML = `
    ${progressHTML()}
    ${mapHTML(0)}
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

  container.innerHTML = `
    ${progressHTML()}
    ${mapHTML(index)}
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
  const isLast = evIdx >= events.length - 1;

  container.querySelectorAll('.game-choice').forEach((btn, i) => {
    btn.classList.add('game-choice--disabled');
    if (i === choiceIdx) btn.classList.add('game-choice--selected');
  });

  const result = document.createElement('div');
  result.className = 'game-result';
  result.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
  container.querySelector('#choices').after(result);

  setTimeout(() => {
    if (isLast) {
      /* For the last event, tease the result and show Discord CTA instead */
      result.innerHTML = `
        <div class="game-teaser">
          <div class="game-teaser__icon">✨</div>
          <div class="game-teaser__title">${t('game.teaserTitle')}</div>
          <div class="game-teaser__text">${t('game.teaserText')}</div>
        </div>
      `;

      const actions = document.createElement('div');
      actions.className = 'game-actions';
      actions.innerHTML = `
        <a href="${DISCORD_INVITE}" target="_blank" rel="noopener" class="btn btn--discord">
          <svg class="btn__icon" viewBox="0 0 71 55" fill="currentColor">
            <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 4.9.2.2 0 0010.4 5C1.5 18.4-.9 31.4.3 44.3v.1a58.7 58.7 0 0017.7 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .4 36.4 36.4 0 01-5.5 2.6.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1A58.5 58.5 0 0070.3 44.3v-.1C71.7 29.5 67.8 16.6 60.2 5a.2.2 0 00-.1-.1zM23.7 36.3c-3.4 0-6.2-3.1-6.2-7s2.8-7 6.2-7 6.3 3.2 6.2 7-2.7 7-6.2 7zm23 0c-3.4 0-6.2-3.1-6.2-7s2.8-7 6.2-7 6.3 3.2 6.2 7-2.7 7-6.2 7z"/>
          </svg>
          ${t('game.joinDiscord')}
        </a>
      `;
      result.after(actions);
    } else {
      /* Normal event: show outcome + reward + continue button */
      result.innerHTML = `
        <div class="game-result__outcome">${choice.outcome}</div>
        <div class="game-result__reward">${choice.reward}</div>
      `;

      const actions = document.createElement('div');
      actions.className = 'game-actions';
      actions.innerHTML = `
        <button class="btn btn--primary btn--small" id="game-next">
          ${t('game.nextEvent')} →
        </button>
      `;
      result.after(actions);

      actions.querySelector('#game-next').addEventListener('click', () => {
        renderTravel();
      });
    }

    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, TYPING_DELAY);
}

/* ---- Step: Travel animation (single map, moving marker) ---- */
function renderTravel() {
  currentStep = 2;
  const from = LOCATIONS[0];
  const to = LOCATIONS[1];
  const fromName = t(`game.locations.${from.key}`);
  const toName = t(`game.locations.${to.key}`);

  container.innerHTML = `
    ${progressHTML()}
    <div class="game-travel">
      <div class="game-travel__header">
        <span class="game-travel__icon">🗺️</span>
        <span class="game-travel__title">${t('game.travelTitle')}</span>
      </div>
      <div class="game-travel__text">${t('game.travelText', { from: fromName, to: toName })}</div>
      <div class="game-map__container game-travel__map-wrapper">
        <img class="game-map__img" src="./public/images/map.webp" alt="Map">
        <div class="game-map__marker game-map__marker--travel" id="travel-marker"
             style="left:${from.x}%;top:${from.y}%"></div>
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

  const fill = container.querySelector('#travel-fill');
  const marker = container.querySelector('#travel-marker');

  // Start animations
  requestAnimationFrame(() => {
    fill.style.width = '100%';
    marker.style.left = `${to.x}%`;
    marker.style.top = `${to.y}%`;
  });

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
