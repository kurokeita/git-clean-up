import { describe, expect, it } from "vitest"
import { isProtectedBranch } from "../branch-protection"

describe("branch-protection", () => {
	it("should return true for common protected branches", () => {
		expect(isProtectedBranch("main")).toBe(true)
	})

	it("should return false for regular feature branches", () => {
		expect(isProtectedBranch("feature/login")).toBe(false)
		expect(isProtectedBranch("bugfix/header")).toBe(false)
		expect(isProtectedBranch("chore/deps")).toBe(false)
	})

	it("should be case-insensitive", () => {
		expect(isProtectedBranch("MAIN")).toBe(true)
	})
})
