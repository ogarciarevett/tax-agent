import { expect, test } from "vitest";
import { banner } from "./banner";

test("banner names the project", () => {
	expect(banner()).toContain("tax-agent");
});
