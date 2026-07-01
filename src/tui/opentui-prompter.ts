import {
	type CliRenderer,
	createCliRenderer,
	InputRenderable,
	InputRenderableEvents,
	TextRenderable,
} from "@opentui/core";
import { banner } from "../banner";
import type { Prompter, Question } from "../interview/interview";

/**
 * opentui-backed Prompter: renders each question as a label + text input and resolves on Enter.
 * Requires a real TTY, so it is exercised by running `pnpm dev` in a terminal — not by unit tests
 * (see A1-spec "Risks & assumptions"). All testable logic lives in ../interview/interview.ts.
 */
export class OpenTuiPrompter implements Prompter {
	private renderer?: CliRenderer;
	private noteSeq = 0;

	private async ensureRenderer(): Promise<CliRenderer> {
		if (!this.renderer) {
			const renderer = await createCliRenderer();
			renderer.start();
			renderer.root.add(
				new TextRenderable(renderer, { id: "banner", content: banner() }),
			);
			this.renderer = renderer;
		}
		return this.renderer;
	}

	async ask(question: Question, prefill?: string): Promise<string> {
		const renderer = await this.ensureRenderer();
		const label = question.help
			? `${question.prompt}\n  ${question.help}`
			: question.prompt;
		renderer.root.add(
			new TextRenderable(renderer, {
				id: `label-${question.key}`,
				content: label,
			}),
		);

		const input = new InputRenderable(renderer, {
			id: `input-${question.key}`,
			value: prefill ?? "",
			placeholder: question.choices ? question.choices.join(" / ") : "",
		});
		renderer.root.add(input);
		input.focus();

		return await new Promise<string>((resolve) => {
			input.once(InputRenderableEvents.ENTER, () => {
				input.blur();
				// Return the raw value; runInterview owns prefill-keep vs clear-optional semantics.
				resolve(input.value);
			});
		});
	}

	note(message: string): void {
		this.noteSeq += 1;
		this.renderer?.root.add(
			new TextRenderable(this.renderer, {
				id: `note-${this.noteSeq}`,
				content: message,
			}),
		);
	}

	async close(): Promise<void> {
		this.renderer?.stop();
	}
}
