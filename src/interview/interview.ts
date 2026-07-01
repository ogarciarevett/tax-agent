import { type Profile, ProfileSchema, parseProfile } from "../domain/profile";

export type AnswerKey =
	| "country"
	| "residency"
	| "taxYear"
	| "filingSituation"
	| "fullName"
	| "taxId";

export interface Question {
	readonly key: AnswerKey;
	readonly prompt: string;
	readonly help?: string;
	readonly choices?: readonly string[];
	readonly optional?: boolean;
}

// The interview order. Choices mirror the domain enums; the schema is still the real gate.
export const QUESTIONS: readonly Question[] = [
	{
		key: "country",
		prompt: "Country (tax jurisdiction)?",
		choices: ["es"],
		help: "Spain only for now.",
	},
	{
		key: "residency",
		prompt: "Tax residency?",
		choices: ["resident", "non_resident"],
	},
	{ key: "taxYear", prompt: "Tax year?", help: "e.g. 2025" },
	{
		key: "filingSituation",
		prompt: "Filing situation?",
		choices: ["employed", "self_employed", "both", "other"],
	},
	{ key: "fullName", prompt: "Full name (optional)?", optional: true },
	{ key: "taxId", prompt: "Tax ID / NIF (optional)?", optional: true },
];

/** A driver for asking questions — implemented by the opentui TUI and by test fakes. */
export interface Prompter {
	ask(question: Question, prefill?: string): Promise<string>;
	note(message: string): void;
	close(): Promise<void>;
}

/** Pure: map raw string answers to a validated Profile (throws ZodError on invalid input). */
export function answersToProfile(
	answers: Readonly<Record<string, string>>,
): Profile {
	const raw: Record<string, unknown> = {
		country: answers.country?.trim(),
		residency: answers.residency?.trim(),
		taxYear: answers.taxYear?.trim(),
		filingSituation: answers.filingSituation?.trim(),
	};
	if (answers.fullName?.trim()) {
		raw.fullName = answers.fullName.trim();
	}
	if (answers.taxId?.trim()) {
		raw.taxId = answers.taxId.trim();
	}
	return parseProfile(raw);
}

export type AnswerCheck =
	| { ok: true; value: string }
	| { ok: false; error: string };

/** Pure: validate a single answer against its field schema. Empty clears an optional field. */
export function validateAnswer(question: Question, raw: string): AnswerCheck {
	const value = raw.trim();
	if (question.optional && value === "") {
		return { ok: true, value: "" };
	}
	const result = ProfileSchema.shape[question.key].safeParse(value);
	if (result.success) {
		return { ok: true, value };
	}
	return {
		ok: false,
		error: result.error.issues[0]?.message ?? "Invalid value.",
	};
}

function prefillFor(
	profile: Profile | null | undefined,
	key: AnswerKey,
): string | undefined {
	if (!profile) {
		return undefined;
	}
	const value = profile[key];
	return value === undefined ? undefined : String(value);
}

/**
 * Ask every question (prefilled from an existing profile), re-asking on invalid input so one
 * bad answer never discards the whole interview, and build the validated Profile.
 */
export async function runInterview(
	prompter: Prompter,
	existing?: Profile | null,
): Promise<Profile> {
	const answers: Record<string, string> = {};
	for (const q of QUESTIONS) {
		const prefill = prefillFor(existing, q.key);
		for (;;) {
			const check = validateAnswer(q, await prompter.ask(q, prefill));
			if (check.ok) {
				answers[q.key] = check.value;
				break;
			}
			prompter.note(`${q.prompt} ${check.error}`);
		}
	}
	return answersToProfile(answers);
}
