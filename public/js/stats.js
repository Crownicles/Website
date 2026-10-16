/*
 * The figures of the homepage, read from their sources so they never go stale. The number written in
 * the page stays as long as a source cannot be reached, and each answer is kept a few hours so visitors
 * do not spend the GitHub quota of 60 requests an hour.
 */
(function () {
	"use strict";

	const CACHE_KEY = "crownicles-stats-v1";
	const CACHE_MS = 6 * 60 * 60 * 1000;
	const lang = document.currentScript?.dataset.lang === "fr" ? "fr" : "en";
	const numbers = new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US");

	/** Large counts are rounded down and marked with a "+", so the figure is never more than the truth. */
	function roundedDown(value, step) {
		return `${numbers.format(Math.floor(value / step) * step)}+`;
	}

	const SOURCES = {
		discord: {
			url: "https://discord.com/api/v10/invites/WwgBfSg?with_counts=true",
			read: async response => (await response.json()).approximate_member_count,
			format: value => roundedDown(value, 100)
		},
		contributors: {
			url: "https://api.github.com/repos/Crownicles/Crownicles/contributors?per_page=1&anon=1",

			// One contributor per page: the number of the last page is the number of contributors.
			read: async response => Number(/[?&]page=(\d+)>; rel="last"/.exec(response.headers.get("Link") ?? "")?.[1]),
			format: value => numbers.format(value)
		},
		guild: {
			url: "https://raw.githubusercontent.com/Crownicles/Crownicles/HEAD/Lib/src/constants/GuildConstants.ts",
			read: async response => Number(/MAX_GUILD_MEMBERS\s*=\s*(\d+)/.exec(await response.text())?.[1]),
			format: value => numbers.format(value)
		},
		guide: {
			url: "https://guide.crownicles.com/llms.txt",

			// GitBook only answers pages served from crownicles.com.
			allowedHost: /(^|\.)crownicles\.com$/,

			// The index lists every page under a heading per language.
			read: async response => {
				const heading = lang === "fr" ? "## Français" : "## English";
				const section = (await response.text()).split(/^## /m).find(part => `## ${part}`.startsWith(heading)) ?? "";
				return section.split("\n").filter(line => line.startsWith("- [")).length;
			},
			format: value => roundedDown(value, 10)
		}
	};

	function loadCache() {
		try {
			const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
			return cache && typeof cache === "object" ? cache : {};
		}
		catch {
			return {};
		}
	}

	function saveCache(cache) {
		try {
			localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
		}
		catch {
			// Storage can be blocked: the figures are simply asked again next time.
		}
	}

	const cache = loadCache();

	async function valueOf(name) {
		const key = `${name}:${lang}`;
		const cached = cache[key];
		if (cached && Date.now() - cached.at < CACHE_MS) {
			return cached.value;
		}
		const response = await fetch(SOURCES[name].url);
		if (!response.ok) {
			throw new Error(`${name}: HTTP ${response.status}`);
		}
		const value = await SOURCES[name].read(response);
		if (!Number.isFinite(value) || value <= 0) {
			throw new Error(`${name}: unreadable answer`);
		}
		cache[key] = { value, at: Date.now() };
		saveCache(cache);
		return value;
	}

	document.querySelectorAll("[data-live-stat]").forEach(node => {
		const name = node.dataset.liveStat;
		const source = SOURCES[name];
		if (!source || (source.allowedHost && !source.allowedHost.test(location.hostname))) {
			return;
		}
		valueOf(name)
			.then(value => {
				node.textContent = source.format(value);
			})
			.catch(() => {
				// The figure written in the page stays.
			});
	});
})();
