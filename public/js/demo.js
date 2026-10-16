/*
 * A playable excerpt of Crownicles, drawn the way the mobile app draws it: the road to Crabs' River,
 * a token to get there now, then event 84 (the crab contest) whose texts and mechanics come from the
 * game's own files, see _data/demo_event.json.
 */
(function () {
	"use strict";

	const dataNode = document.getElementById("demo-data");
	const screen = document.querySelector("[data-demo-screen]");
	const endTemplate = document.getElementById("demo-end");
	if (!dataNode || !screen || !endTemplate) {
		return;
	}

	const data = JSON.parse(dataNode.textContent);
	const ui = data.ui;
	const event = data.event;
	const texts = event.texts;

	const START_PROGRESS = 62;
	const CREEP_LIMIT = 70;
	const CREEP_STEP = 0.25;
	const CREEP_MS = 1000;
	const START_MINUTES = 67;
	const COIN_SPEND_MS = 900;
	const DASH_MS = 1100;
	const ARRIVAL_PAUSE_MS = 900;
	const ANSWER_DELAY_MS = 500;
	const FLASH_MS = 1400;

	const numberFormat = new Intl.NumberFormat(data.lang === "fr" ? "fr-FR" : "en-US");
	const ARROW = "<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h14\"/><path d=\"m12 5 7 7-7 7\"/></svg>";
	const BOOK = "<svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 7v14\"/><path d=\"M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z\"/></svg>";

	const initialPlayer = { health: 80, maxHealth: 100, money: 320, tokens: 5, score: 1240, collected: 176 };
	let player = { ...initialPlayer };
	let creep = null;

	function escapeHtml(text) {
		return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	}

	function format(template, values) {
		return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] : match));
	}

	/** Twemoji names its files after the code points, without the variation selector. */
	function emoji(char) {
		const file = Array.from(char).map(part => part.codePointAt(0).toString(16)).filter(point => point !== "fe0f").join("-");
		return `<img class="emoji" src="${data.emojiBase}${file}.svg" alt="${char}" draggable="false">`;
	}

	function signed(amount) {
		return amount > 0 ? `+${numberFormat.format(amount)}` : numberFormat.format(amount);
	}

	/** Same wording as the app: "30 minutes", "5 h", "1 h 30". */
	function duration(total) {
		const hours = Math.floor(total / 60);
		const minutes = total % 60;
		if (hours === 0) {
			return format(total === 1 ? ui.minutes_one : ui.minutes_other, { n: total });
		}
		return minutes === 0 ? format(ui.hours, { h: hours }) : format(ui.hours_minutes, { h: hours, m: String(minutes).padStart(2, "0") });
	}

	function wait(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	function stopCreep() {
		if (creep !== null) {
			clearInterval(creep);
			creep = null;
		}
	}

	const capsule = document.querySelector("[data-capsule]");
	const ring = document.querySelector("[data-ring]");

	function setRing(progress) {
		if (ring) {
			ring.style.setProperty("--progress", String(progress));
		}
	}

	/** The phone keeps its size: a new screen only scrolls its own content back to the top. */
	function show(html, { tabs = false } = {}) {
		stopCreep();
		screen.innerHTML = `<div class="app-view">${html}</div>`;
		screen.scrollTop = 0;

		// As in the app, an event holds the player on the adventure: the tab bar is hidden until it is over.
		if (capsule) {
			capsule.hidden = !tabs;
		}
	}

	function journal(emblem, story, effects) {
		return `<article class="journal">
			<div class="journal__head"><div class="journal__emblem">${emoji(emblem)}</div>${escapeHtml(ui.journal)}</div>
			${effects || ""}
			<p class="story">${story}</p>
		</article>`;
	}

	// ---------- The player's vitals, in the app bar ----------

	function flash(name, delta) {
		const chip = document.querySelector(`[data-chip="${name}"]`);
		if (!chip || delta === 0) {
			return;
		}
		const tone = delta > 0 ? "is-gain" : "is-loss";
		chip.classList.add(tone);
		setTimeout(() => chip.classList.remove(tone), FLASH_MS);
	}

	function renderVitals() {
		document.querySelector("[data-stat=\"health\"]").textContent = `${player.health} / ${player.maxHealth}`;
		document.querySelector("[data-stat-fill=\"health\"]").style.width = `${(player.health / player.maxHealth) * 100}%`;
		document.querySelector("[data-stat=\"money\"]").textContent = numberFormat.format(player.money);
		document.querySelector("[data-stat=\"tokens\"]").textContent = numberFormat.format(player.tokens);
		document.querySelector("[data-stat=\"score\"]").textContent = numberFormat.format(player.score);
	}

	function apply(mechanics, points) {
		const moneyBefore = player.money;
		player.health = Math.min(player.maxHealth, Math.max(1, player.health + (mechanics.health || 0)));
		player.money = Math.max(0, player.money + (mechanics.money || 0));
		player.score += points;
		renderVitals();
		flash("money", player.money - moneyBefore);
		flash("score", points);
	}

	// ---------- 1. On the road ----------

	function renderTravel() {
		show(`
			<div class="standing">
				<div class="standing__emblem">${emoji("😃")}</div>
				<div>
					<p class="standing__caption" data-caption>${escapeHtml(ui.travel_caption)}</p>
					<p class="standing__title" data-title>${escapeHtml(ui.travel_title)}</p>
					<p class="standing__subtitle" data-subtitle>${escapeHtml(ui.travel_subtitle)}</p>
				</div>
			</div>
			<div class="road" data-road aria-hidden="true">
				${emoji("🛣️")}
				<div class="road__track">
					<div class="road__fill" data-road-fill style="width: ${START_PROGRESS}%"></div>
					<span class="road__runner" data-road-runner style="left: ${START_PROGRESS}%">${emoji("🚶")}</span>
				</div>
				${emoji("🏞️")}
			</div>
			<div class="figures">
				<div class="figure"><span>${escapeHtml(ui.remaining)}</span><b data-remaining>${escapeHtml(duration(START_MINUTES))}</b></div>
				<div class="figure"><span>${escapeHtml(ui.next_stop)}</span><b data-next>${escapeHtml(duration(START_MINUTES))}</b></div>
				<div class="figure"><span>${escapeHtml(ui.collected)}</span><b>${numberFormat.format(player.collected)} ${emoji("🏅")}</b></div>
			</div>
			<button class="action-banner" type="button" data-advance>
				${emoji("🪙")}<span>${escapeHtml(ui.advance)}</span>${ARROW}
			</button>
		`, { tabs: true });

		const road = screen.querySelector("[data-road]");
		const fill = screen.querySelector("[data-road-fill]");
		const runner = screen.querySelector("[data-road-runner]");
		const moveTo = progress => {
			fill.style.width = `${progress}%`;
			runner.style.left = `${progress}%`;
			setRing(progress);
		};
		moveTo(START_PROGRESS);

		// The traveller keeps walking on their own, as the trip runs in real time.
		let progress = START_PROGRESS;
		creep = setInterval(() => {
			progress = Math.min(CREEP_LIMIT, progress + CREEP_STEP);
			moveTo(progress);
		}, CREEP_MS);

		const button = screen.querySelector("[data-advance]");
		button.addEventListener("click", async () => {
			stopCreep();
			button.disabled = true;
			button.classList.add("is-pressed");
			await wait(COIN_SPEND_MS);

			player.tokens -= 1;
			renderVitals();
			flash("tokens", -1);

			road.classList.add("is-dashing");
			ring?.classList.add("is-dashing");
			moveTo(100);
			await wait(DASH_MS);
			ring?.classList.remove("is-dashing");

			button.classList.remove("is-pressed");
			button.innerHTML = `${BOOK}<span>${escapeHtml(ui.continue_report)}</span>${ARROW}`;
			road.classList.remove("is-dashing");
			screen.querySelector("[data-caption]").textContent = ui.arrived_caption;
			screen.querySelector("[data-title]").textContent = ui.arrived_title;
			screen.querySelector("[data-subtitle]").textContent = ui.arrived_subtitle;
			screen.querySelector("[data-remaining]").textContent = ui.now;
			screen.querySelector("[data-next]").textContent = ui.now;
			await wait(ARRIVAL_PAUSE_MS);
			renderEvent();
		}, { once: true });
	}

	// ---------- 2. The event and its choices ----------

	function renderEvent() {
		const choices = event.order.map(possibility => `
			<button class="choice" type="button" data-choice="${possibility}">
				${emoji(event.icons[possibility])}<span>${escapeHtml(texts.choices[possibility])}</span>${ARROW}
			</button>`).join("");

		show(`
			${journal("🦀", escapeHtml(texts.intro))}
			<p class="section-header">${escapeHtml(ui.your_action)}</p>
			<div class="choices">${choices}</div>
		`);

		const buttons = Array.from(screen.querySelectorAll("[data-choice]"));
		buttons.forEach(button => button.addEventListener("click", () => {
			buttons.forEach(other => {
				other.disabled = true;
				other.classList.toggle("is-chosen", other === button);
			});
			screen.querySelector(".choices").insertAdjacentHTML("afterend", `<p class="note">${escapeHtml(ui.answering)}</p>`);
			setTimeout(() => renderOutcome(button.dataset.choice), ANSWER_DELAY_MS);
		}));
	}

	// ---------- 3. What fate decided ----------

	function effectsOf(mechanics, points) {
		const effects = [{ label: ui.fields.points, value: signed(points), gain: true, icon: "🏅" }];
		if (mechanics.money) {
			effects.push({ label: ui.fields.money, value: signed(mechanics.money), gain: mechanics.money > 0, icon: mechanics.money > 0 ? "💰" : "💸" });
		}
		if (mechanics.health) {
			effects.push({ label: ui.fields.health, value: signed(mechanics.health), gain: mechanics.health > 0, icon: mechanics.health > 0 ? "❤️" : "💔" });
		}
		const lostTime = mechanics.lostTime || event.effectDurations[mechanics.effect];
		if (lostTime) {
			effects.push({ label: ui.fields.time_lost, value: duration(lostTime), gain: false, icon: event.effectIcons[mechanics.effect] || "🕑" });
		}
		return effects.map((effect, order) => `<span class="effect effect--${effect.gain ? "gain" : "loss"}" style="animation-delay: ${order * 90}ms">${emoji(effect.icon)}<span>${escapeHtml(effect.label)}</span><b>${escapeHtml(effect.value)}</b></span>`).join("");
	}

	function renderOutcome(possibility) {
		const keys = Object.keys(texts.outcomes[possibility]);
		const key = keys[Math.floor(Math.random() * keys.length)];
		const mechanics = event.mechanics[possibility][key];
		const points = 60 + Math.floor(Math.random() * 80);

		// As on Discord, an alteration other than being busy ends the story with its emoji.
		const alteration = mechanics.effect && mechanics.effect !== "occupied" ? ` ${emoji(event.effectIcons[mechanics.effect])}` : "";

		show(`
			${journal(event.icons[possibility], escapeHtml(texts.outcomes[possibility][key]) + alteration, `<div class="effects">${effectsOf(mechanics, points)}</div>`)}
			<button class="action-banner" type="button" data-continue>${BOOK}<span>${escapeHtml(ui.continue)}</span>${ARROW}</button>
		`);

		apply(mechanics, points);
		screen.querySelector("[data-continue]").addEventListener("click", renderEnd);
	}

	// ---------- 4. Where to go on ----------

	function renderEnd() {
		show("");
		screen.firstElementChild.appendChild(endTemplate.content.cloneNode(true));
		screen.querySelector("[data-restart]").addEventListener("click", () => {
			player = { ...initialPlayer };
			renderVitals();
			renderTravel();
		});
	}

	renderVitals();
	renderTravel();
})();
