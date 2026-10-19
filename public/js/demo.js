/*
 * A playable excerpt of Crownicles, drawn the way the mobile app draws it: the road to Crabs' River,
 * a token to get there now, then event 84 (the crab contest) whose texts and mechanics come from the
 * game's own files, see _data/demo_event.json.
 */
(function () {
	"use strict";

	const dataNode = document.getElementById("demo-data");
	const viewport = document.querySelector("[data-demo-screen]");
	const endTemplate = document.getElementById("demo-end");
	if (!dataNode || !viewport || !endTemplate) {
		return;
	}

	// The adventure keeps its own layer, so a look at another tab never loses where the story stands.
	const screen = document.createElement("div");
	const elsewhere = document.createElement("div");
	elsewhere.hidden = true;
	viewport.replaceChildren(screen, elsewhere);

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

	const siteHeader = document.querySelector(".site-header");
	let started = false;

	/**
	 * A new screen starts at its top. On a computer the phone scrolls its own content; on a small screen the
	 * page does, so it is the page that comes back to the top of the screen if the visitor had gone past it.
	 */
	function backToTop({ smooth = false } = {}) {
		viewport.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
		const above = viewport.getBoundingClientRect().top - (siteHeader ? siteHeader.offsetHeight : 0);
		if (above < 0) {
			window.scrollBy({ top: above - 12, behavior: smooth ? "smooth" : "auto" });
		}
	}

	function show(html, { tabs = false } = {}) {
		stopCreep();
		screen.innerHTML = `<div class="app-view">${html}</div>`;
		if (started) {
			backToTop();
		}

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
		show("", { tabs: true });
		screen.firstElementChild.appendChild(endTemplate.content.cloneNode(true));
		screen.querySelector("[data-restart]").addEventListener("click", () => {
			player = { ...initialPlayer };
			renderVitals();
			renderTravel();
		});
	}

	renderVitals();
	renderTravel();
	started = true;

	// ---------- 5. The other tabs: their front pages as mockups, the pages behind them stay in the app ----------

	const TOAST_MS = 1800;
	const XP = { value: 1870, max: 2600 };
	const ENERGY = { value: 64, max: 100 };
	const GLORY = 1480;
	const icon = paths => `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
	const STAR = icon("<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\"/>");
	const HEART = icon("<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"/>");
	const GIFT = icon("<rect x=\"3\" y=\"8\" width=\"18\" height=\"4\" rx=\"1\"/><path d=\"M12 8v13\"/><path d=\"M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7\"/><path d=\"M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5\"/>");
	const SWORDS = icon("<path d=\"m13 19 6-6\"/><path d=\"M14.5 17.5 3.586 6.586A2 2 0 013 5.172V3h2.172a2 2 0 011.414.586L17.5 14.5\"/><path d=\"m14.828 6.172 2.586-2.586A2 2 0 0118.828 3H21v2.172a2 2 0 01-.586 1.414l-2.586 2.586\"/><path d=\"m16 16 4 4\"/><path d=\"m19 21 2-2\"/><path d=\"m5 14 4 4\"/><path d=\"m5 21-2-2\"/><path d=\"M7.5 16.5 4 20\"/>");

	const count = value => numberFormat.format(value);

	function gauge(label, glyph, value, max, tone) {
		return `<div class="gauge" style="--tone: var(--${tone})">
			<div class="gauge__head"><span>${glyph}${escapeHtml(label)}</span><b>${count(value)} / ${count(max)}</b></div>
			<div class="gauge__track"><div class="gauge__fill" style="width: ${(value / max) * 100}%"></div></div>
		</div>`;
	}

	/** Same layout as the road's header: emblem, caption, title, then the gauges that belong to it. */
	function standing(emblem, caption, title, subtitle, gauges = "") {
		return `<div class="standing standing--still">
			<div class="standing__emblem">${emblem}</div>
			<div>
				<p class="standing__caption">${escapeHtml(caption)}</p>
				<p class="standing__title">${escapeHtml(title)}</p>
				${subtitle ? `<p class="standing__subtitle">${subtitle}</p>` : ""}
			</div>
		</div>${gauges ? `<div class="gauges">${gauges}</div>` : ""}`;
	}

	function banner(glyph, label) {
		return `<button class="action-banner mock-banner" type="button" data-in-app>${glyph}<span>${escapeHtml(label)}</span>${ARROW}</button>`;
	}

	function quickActions(items) {
		return `<div class="quick-actions">${items.map(([glyph, label]) => `<button class="quick-action" type="button" data-in-app>${emoji(glyph)}<span>${escapeHtml(label)}</span></button>`).join("")}</div>`;
	}

	function figures(items) {
		return `<div class="figures figures--panel">${items.map(([label, value]) => `<div class="figure"><span>${escapeHtml(label)}</span><b>${value}</b></div>`).join("")}</div>`;
	}

	function keyValues(items) {
		return `<div class="list">${items.map(([label, value]) => `<div class="key-value"><span>${escapeHtml(label)}</span><b>${value}</b></div>`).join("")}</div>`;
	}

	function rows(items) {
		return `<div class="list">${items.map(item => `<button class="list__row" type="button" data-in-app>
			<span class="list__emblem">${emoji(item.icon)}</span>
			<span class="list__text"><b>${escapeHtml(item.title)}${item.self ? ` <em>${escapeHtml(ui.guild.you)}</em>` : ""}</b><span>${escapeHtml(item.subtitle)}</span></span>
			${item.value ? `<span class="list__value">${item.value}</span>` : ""}
		</button>`).join("")}</div>`;
	}

	function section(title, body, { glyph, hint, action } = {}) {
		const side = action
			? `<button class="mock-section__action" type="button" data-in-app>${escapeHtml(action)}</button>`
			: hint ? `<span class="mock-section__hint">${escapeHtml(hint)}</span>` : "";
		return `<section class="mock-section">
			<div class="mock-section__head"><p class="section-header">${glyph ? emoji(glyph) : ""}${escapeHtml(title)}</p>${side}</div>
			${body}
		</section>`;
	}

	function renderProfile() {
		const text = ui.profile;
		return `
			${standing(emoji("⚜️"), text.eyebrow, ui.hero, escapeHtml(text.subtitle),
				gauge(ui.health, emoji("❤️"), player.health, player.maxHealth, "red")
				+ gauge(ui.energy, emoji("⚡"), ENERGY.value, ENERGY.max, "green")
				+ gauge(ui.experience, STAR, XP.value, XP.max, "gold"))}
			${quickActions([["📦", text.actions[0]], ["📖", text.actions[1]], ["⛩️", text.actions[2]]])}
			${section(text.statistics, figures([[text.attack, count(142)], [text.defense, count(118)], [text.speed, count(96)]]), { glyph: "🗡️" })}
			${section(text.score_rank, figures([[text.score, `${emoji("🏅")}${count(player.score)}`], [text.glory, `${emoji("✨")}${count(GLORY)}`]])
				+ keyValues([[text.rank, `${count(3412)} / ${count(48920)}`], [text.league, `${emoji("🥈")}${escapeHtml(ui.league_name)}`]]), { glyph: "🏆", action: text.rankings })}
			${section(text.campaign, `<div class="panel">${gauge(text.progress, "", 34, 70, "ink")}</div>`, { glyph: "📖" })}
			${section(text.information, rows([
				{ icon: "🏟️", title: ui.guild.name, subtitle: text.guild },
				{ icon: "🦊", title: ui.pet.name, subtitle: text.pet }
			]))}
		`;
	}

	function renderPet() {
		const text = ui.pet;
		return `
			<div class="pet-standing">${standing(emoji("🦊"), text.eyebrow, text.name, `${escapeHtml(text.subtitle)} ${emoji("♂️")}`, gauge(text.mood, HEART, 4, 5, "green"))}</div>
			${banner(emoji("🍖"), text.feed)}
			${quickActions([["😻", text.actions[0]], ["🗺️", text.actions[1]], ["🖋️", text.actions[2]]])}
		`;
	}

	function renderGuild() {
		const text = ui.guild;
		const roles = text.roles;
		const member = (icon, title, role, level, score, self = false) => ({
			icon, title, self, subtitle: `${role} · ${format(text.level_short, { n: level })}`, value: `${emoji("🏅")}${count(score)}`
		});
		const members = [
			member("👑", "Aldric", roles.chief, 41, 18420),
			member("🎖️", "Mirelle", roles.elder, 33, 11960),
			member("⚫", ui.hero, roles.member, 12, player.score, true),
			member("⚫", "Bastien", roles.member, 27, 7310),
			member("⚫", "Ysolde", roles.member, 19, 4880),
			member("⚫", "Gauvain", roles.member, 8, 960)
		];
		return `
			${standing(emoji("🏟️"), text.eyebrow, text.name, escapeHtml(text.level), gauge(ui.experience, STAR, 7420, 9800, "gold"))}
			${figures([[text.score, `${emoji("🏅")}${count(48210)}`], [text.treasury, `${emoji("💰")}${count(12400)}`], [text.rank, `${count(214)} / ${count(3980)}`]])}
			<p class="mock-note">${escapeHtml(text.description)}</p>
			${banner(GIFT, text.daily)}
			${quickActions([["🍬", text.actions[0]], ["🐾", text.actions[1]], ["🏆", text.actions[2]]])}
			${section(text.members, rows(members), { hint: String(members.length) })}
		`;
	}

	function renderArena() {
		const text = ui.arena;
		return `
			${standing(SWORDS, text.eyebrow, text.title, "")}
			<div class="arena-identity">${rows([{ icon: "⚜️", title: ui.hero, subtitle: text.subtitle }])}</div>
			<div class="panel">${gauge(ui.energy, emoji("⚡"), ENERGY.value, ENERGY.max, "green")}</div>
			${figures([[text.glory, `${emoji("✨")}${count(GLORY)}`], [text.league, `${emoji("🥈")}${escapeHtml(ui.league_name)}`]])}
			${banner(emoji("⚔️"), text.start)}
			${quickActions([["⚜️", text.actions[0]], ["📜", text.actions[1]], ["🥈", text.actions[2]], ["🏆", text.actions[3]]])}
		`;
	}

	const mockups = { profile: renderProfile, pet: renderPet, guild: renderGuild, arena: renderArena };
	const tabButtons = Array.from(document.querySelectorAll("[data-tab]"));
	let openTab = "adventure";

	function selectTab(name) {
		if (name === openTab) {
			backToTop({ smooth: true });
			return;
		}
		openTab = name;
		tabButtons.forEach(button => {
			const focused = button.dataset.tab === name;
			button.classList.toggle("is-focused", focused);
			button.setAttribute("aria-selected", String(focused));
		});
		const away = name in mockups;
		screen.hidden = away;
		elsewhere.hidden = !away;
		elsewhere.innerHTML = away ? `<div class="app-view">${mockups[name]()}</div>` : "";
		backToTop();
	}

	tabButtons.forEach(button => button.addEventListener("click", () => selectTab(button.dataset.tab)));

	// ---------- 6. What only the app does: a short word rather than a dead tap ----------

	const toast = document.querySelector("[data-toast]");
	let toastTimer = null;

	function inAppOnly() {
		if (!toast) {
			return;
		}
		toast.textContent = ui.in_app;
		toast.classList.add("is-shown");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => toast.classList.remove("is-shown"), TOAST_MS);
	}

	elsewhere.addEventListener("click", clicked => {
		if (clicked.target.closest("[data-in-app]")) {
			inAppOnly();
		}
	});
	document.querySelector(".app-header__gear")?.addEventListener("click", inAppOnly);

	// ---------- 7. The invitation to play, until the visitor touches the phone ----------

	const phone = document.querySelector("[data-phone]");
	const cue = document.querySelector("[data-try-cue]");
	if (phone && cue) {
		const reveal = new IntersectionObserver(entries => {
			if (entries.some(entry => entry.isIntersecting)) {
				cue.classList.add("is-visible");
				reveal.disconnect();
			}
		}, { threshold: 0.35 });
		reveal.observe(phone);

		phone.addEventListener("click", () => cue.classList.add("is-dismissed"), { once: true });
	}
})();
