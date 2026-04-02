import { describe, expect, it } from "vitest"
import {
	isProtectedBranch,
	matchesBranchPattern,
	matchesBranchPatterns,
} from "../branch-protection"

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

	it("supports wildcard branch protection patterns", () => {
		expect(matchesBranchPattern("release/2026.04", "release/*")).toBe(true)
		expect(matchesBranchPattern("feature/login", "release/*")).toBe(false)
	})

	it("matches against a list of patterns", () => {
		expect(
			matchesBranchPatterns("hotfix/security", ["release/*", "hotfix/*"]),
		).toBe(true)
	})

	it("allows custom protected branch lists", () => {
		expect(isProtectedBranch("release/2026.04", ["release/*"])).toBe(true)
	})
})
