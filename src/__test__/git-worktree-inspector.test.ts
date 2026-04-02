import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execa } from "execa"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { inspectWorktree } from "../git-worktree-inspector"

vi.mock("execa")

describe("inspectWorktree", () => {
	const testDir = join(tmpdir(), "git-clean-up-test-worktree-inspector")

	beforeEach(async () => {
		await mkdir(testDir, { recursive: true })
	})

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true })
		vi.clearAllMocks()
	})

	it("identifies a clean worktree", async () => {
		vi.mocked(execa).mockImplementation((cmd, args) => {
			if (args[0] === "status") {
				return Promise.resolve({ stdout: "" }) as any
			}
			if (args[0] === "rev-parse" && args[3] === "@{u}") {
				return Promise.resolve({ stdout: "origin/feature" }) as any
			}
			if (args[0] === "rev-list") {
				return Promise.resolve({ stdout: "0" }) as any
			}
			return Promise.resolve({ stdout: "" }) as any
		})

		const insight = await inspectWorktree(testDir, "feature")

		expect(insight.isDirty).toBe(false)
		expect(insight.hasUntracked).toBe(false)
		expect(insight.unpushedCount).toBe(0)
		expect(insight.safetyWarnings).toEqual([])
	})

	it("identifies a dirty worktree", async () => {
		vi.mocked(execa).mockImplementation((cmd, args) => {
			if (args[0] === "status") {
				return Promise.resolve({ stdout: " M modified.ts" }) as any
			}
			return Promise.resolve({ stdout: "" }) as any
		})

		const insight = await inspectWorktree(testDir, "feature")

		expect(insight.isDirty).toBe(true)
		expect(insight.safetyWarnings).toContain("Has uncommitted changes")
	})

	it("identifies untracked files", async () => {
		vi.mocked(execa).mockImplementation((cmd, args) => {
			if (args[0] === "status") {
				return Promise.resolve({ stdout: "?? new-file.ts" }) as any
			}
			return Promise.resolve({ stdout: "" }) as any
		})

		const insight = await inspectWorktree(testDir, "feature")

		expect(insight.hasUntracked).toBe(true)
		expect(insight.safetyWarnings).toContain("Has untracked files")
	})

	it("identifies unpushed commits", async () => {
		vi.mocked(execa).mockImplementation((cmd, args) => {
			if (args[0] === "status") {
				return Promise.resolve({ stdout: "" }) as any
			}
			if (args[0] === "rev-parse" && args[3] === "@{u}") {
				return Promise.resolve({ stdout: "origin/feature" }) as any
			}
			if (args[0] === "rev-list") {
				return Promise.resolve({ stdout: "3" }) as any
			}
			return Promise.resolve({ stdout: "" }) as any
		})

		const insight = await inspectWorktree(testDir, "feature")

		expect(insight.unpushedCount).toBe(3)
		expect(insight.safetyWarnings).toContain("3 unpushed commits")
	})
})
