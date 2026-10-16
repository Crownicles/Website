/*
 * Day and Night themes, switched like in the app (App/src/design/ThemeTransition.tsx): the new theme
 * spreads from the button as a growing circle over the old one, in 520 ms with an ease-out cubic.
 */
(function () {
	"use strict";

	const REVEAL_MS = 520;
	const START_SCALE = 0.01;
	const STORAGE_KEY = "theme";
	const root = document.documentElement;
	const button = document.querySelector("[data-theme-toggle]");
	const system = matchMedia("(prefers-color-scheme: dark)");
	const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

	function storedTheme() {
		try {
			return localStorage.getItem(STORAGE_KEY);
		}
		catch {
			return null;
		}
	}

	function label() {
		if (button) {
			button.setAttribute("aria-label", root.dataset.theme === "dark" ? button.dataset.labelLight : button.dataset.labelDark);
		}
	}

	function apply(theme) {
		root.dataset.theme = theme;
		label();
	}

	/** The circle must reach the farthest corner of the window from where it starts. */
	function coveringRadius(x, y) {
		return Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
	}

	function change(theme, origin) {
		try {
			localStorage.setItem(STORAGE_KEY, theme);
		}
		catch {
			// Storage can be blocked: the choice still holds for this page.
		}
		if (!document.startViewTransition || reducedMotion.matches) {
			apply(theme);
			return;
		}
		const radius = coveringRadius(origin.x, origin.y);
		const transition = document.startViewTransition(() => apply(theme));
		transition.ready.then(() => {
			root.animate({
				clipPath: [
					`circle(${radius * START_SCALE}px at ${origin.x}px ${origin.y}px)`,
					`circle(${radius}px at ${origin.x}px ${origin.y}px)`
				]
			}, {
				duration: REVEAL_MS,
				easing: "cubic-bezier(0.33, 1, 0.68, 1)",
				pseudoElement: "::view-transition-new(root)"
			});
		}).catch(() => {});
	}

	label();

	button?.addEventListener("click", event => {
		const box = button.getBoundingClientRect();
		const origin = event.detail > 0
			? { x: event.clientX, y: event.clientY }
			: { x: box.left + box.width / 2, y: box.top + box.height / 2 };
		change(root.dataset.theme === "dark" ? "light" : "dark", origin);
	});

	// Until a theme is chosen here, the site follows the system's, as the app does by default.
	system.addEventListener("change", event => {
		if (!storedTheme()) {
			apply(event.matches ? "dark" : "light");
		}
	});
})();
