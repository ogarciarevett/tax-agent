import { describe, expect, it } from "vitest";
import type { Profile } from "../domain/profile";
import {
	answersToProfile,
	type Prompter,
	QUESTIONS,
	type Question,
	runInterview,
	validateAnswer,
} from "./interview";

/**
 * A scripted prompter. Each key maps to one answer (returned every time) or an array of answers
 * consumed in order (to simulate an invalid answer followed by a correction). Records the prefills
 * it was handed and every note (error feedback) it received.
 */
class FakePrompter implements Prompter {
	readonly seenPrefills: Array<string | undefined> = [];
	readonly notes: string[] = [];
	private readonly queues: Map<string, string[]>;
	constructor(answers: Readonly<Record<string, string | string[]>>) {
		this.queues = new Map(
			Object.entries(answers).map(([k, v]) => [
				k,
				Array.isArray(v) ? [...v] : [v],
			]),
		);
	}
	async ask(question: Question, prefill?: string): Promise<string> {
		this.seenPrefills.push(prefill);
		const queue = this.queues.get(question.key) ?? [""];
		return queue.length > 1 ? (queue.shift() ?? "") : (queue[0] ?? "");
	}
	note(message: string): void {
		this.notes.push(message);
	}
	async close(): Promise<void> {}
}

const answers = {
	country: "es",
	residency: "resident",
	taxYear: "2025",
	filingSituation: "self_employed",
	fullName: "Omar G",
	taxId: "12345678Z",
};

describe("answersToProfile", () => {
	it("maps string answers to a validated Profile", () => {
		const p = answersToProfile(answers);
		expect(p).toMatchObject({
			id: "me",
			country: "es",
			taxYear: 2025,
			fullName: "Omar G",
		});
	});

	it("trims required answers", () => {
		const p = answersToProfile({
			...answers,
			country: "  es  ",
			taxYear: " 2025 ",
		});
		expect(p.country).toBe("es");
		expect(p.taxYear).toBe(2025);
	});

	it("drops blank optional answers instead of failing validation", () => {
		const p = answersToProfile({ ...answers, fullName: "   ", taxId: "" });
		expect(p.fullName).toBeUndefined();
		expect(p.taxId).toBeUndefined();
	});

	it("throws on an invalid answer (bad country)", () => {
		expect(() => answersToProfile({ ...answers, country: "fr" })).toThrow();
	});
});

describe("validateAnswer", () => {
	const countryQ: Question = {
		key: "country",
		prompt: "Country?",
		choices: ["es"],
	};
	const taxIdQ: Question = { key: "taxId", prompt: "Tax ID?", optional: true };

	it("accepts and trims a valid required answer", () => {
		expect(validateAnswer(countryQ, " es ")).toEqual({ ok: true, value: "es" });
	});

	it("rejects an invalid required answer with a message", () => {
		const r = validateAnswer(countryQ, "fr");
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.error.length).toBeGreaterThan(0);
		}
	});

	it("treats a blank optional answer as a cleared field", () => {
		expect(validateAnswer(taxIdQ, "   ")).toEqual({ ok: true, value: "" });
	});
});

describe("runInterview", () => {
	it("asks every question and returns the built profile", async () => {
		const p = await runInterview(new FakePrompter(answers));
		expect(p.filingSituation).toBe("self_employed");
	});

	it("prefills each question from an existing profile (review/edit)", async () => {
		const existing: Profile = {
			id: "me",
			country: "es",
			residency: "non_resident",
			taxYear: 2024,
			filingSituation: "employed",
			fullName: "Prior Name",
			taxId: "99999999R",
		};
		const fake = new FakePrompter(answers);
		await runInterview(fake, existing);
		expect(fake.seenPrefills).toEqual([
			"es",
			"non_resident",
			"2024",
			"employed",
			"Prior Name",
			"99999999R",
		]);
	});

	it("passes no prefill when there is no existing profile", async () => {
		const fake = new FakePrompter(answers);
		await runInterview(fake, null);
		expect(fake.seenPrefills).toEqual(QUESTIONS.map(() => undefined));
	});

	it("passes undefined prefill for optional fields absent from the existing profile", async () => {
		const existing: Profile = {
			id: "me",
			country: "es",
			residency: "resident",
			taxYear: 2025,
			filingSituation: "employed",
			// no fullName / taxId
		};
		const fake = new FakePrompter(answers);
		await runInterview(fake, existing);
		expect(fake.seenPrefills[0]).toBe("es");
		expect(fake.seenPrefills[4]).toBeUndefined(); // fullName
		expect(fake.seenPrefills[5]).toBeUndefined(); // taxId
	});

	it("re-asks on invalid input and notes the error, then accepts a correction", async () => {
		const fake = new FakePrompter({ ...answers, country: ["fr", "es"] });
		const p = await runInterview(fake);
		expect(p.country).toBe("es");
		expect(fake.notes.some((n) => n.includes("Country"))).toBe(true);
	});

	it("clears an optional field when the answer is blanked, overriding the prefill", async () => {
		const existing: Profile = {
			id: "me",
			country: "es",
			residency: "resident",
			taxYear: 2025,
			filingSituation: "employed",
			fullName: "Prior",
			taxId: "11111111H",
		};
		const p = await runInterview(
			new FakePrompter({ ...answers, taxId: "" }),
			existing,
		);
		expect(p.taxId).toBeUndefined();
	});
});
