/*
 * The trailer is a plain link to YouTube. With JavaScript, a click swaps it for the player, from
 * youtube-nocookie.com, so nothing is loaded from YouTube before the visitor asks for the video.
 */
(function () {
	"use strict";

	for (const link of document.querySelectorAll("[data-youtube]")) {
		link.addEventListener("click", event => {
			// A click meant to open the video elsewhere (new tab, new window) keeps the link's behaviour.
			if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
				return;
			}
			event.preventDefault();
			const iframe = document.createElement("iframe");
			iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(link.dataset.youtube)}?autoplay=1&rel=0`;
			iframe.title = link.dataset.title;
			iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
			iframe.allowFullscreen = true;
			const player = document.createElement("div");
			player.className = "trailer trailer--playing";
			player.append(iframe);
			link.replaceWith(player);
			iframe.focus();
		});
	}
})();
