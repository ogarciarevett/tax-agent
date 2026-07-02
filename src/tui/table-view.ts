import { createCliRenderer, TextRenderable } from "@opentui/core";

/**
 * Show a pre-rendered table string in an opentui view and resolve when the user presses q, Esc or
 * Ctrl-C. Requires a real TTY, so — like opentui-prompter.ts — it is proven by running `pnpm dev`
 * in a terminal, not by unit tests, and is excluded from coverage. All formatting is done upstream
 * by the pure renderMonthTable; this file only paints the string and waits for a quit key.
 */
export async function showTable(text: string): Promise<void> {
	const renderer = await createCliRenderer();
	renderer.start();
	renderer.root.add(
		new TextRenderable(renderer, { id: "table", content: text }),
	);
	renderer.root.add(
		new TextRenderable(renderer, {
			id: "hint",
			content: "\n(pulsa q / Esc para salir)",
		}),
	);

	await new Promise<void>((resolve) => {
		renderer.keyInput.on("keypress", (key) => {
			if (
				key.name === "q" ||
				key.name === "escape" ||
				(key.ctrl && key.name === "c")
			) {
				resolve();
			}
		});
	});

	renderer.stop();
	renderer.destroy();
}
