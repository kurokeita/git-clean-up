import { mkdir, rm } from "node:fs/promises"
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
		vi.mocked(execa).mockImplementation(async (_cmd, args) => {
			const arg0 = args?.[0]
			const arg3 = args?.[3]
			if (arg0 === "status") {
				return { stdout: "" } as never
			}
			if (arg0 === "rev-parse" && arg3 === "@{u}") {
				return { stdout: "origin/feature" } as never
			}
			if (arg0 === "rev-list") {
				return { stdout: "0" } as never
			}
			return { stdout: "" } as never
		})

		const insight = await inspectWorktree(testDir, "feature")

		expect(insight.isDirty).toBe(false)
		expect(insight.hasUntracked).toBe(false)
		expect(insight.unpushedCount).toBe(0)
		expect(insight.safetyWarnings).toEqual([])
	})

	it("identifies a dirty worktree", async () => {
		vi.mocked(execa).mockImplementation(async (_cmd, args) => {
			if (args?.[0] === "status") {
				return { stdout: " M modified.ts" } as never
			}
			return { stdout: "" } as never
		})

		const insight = await inspectWorktree(testDir, "feature")

		expect(insight.isDirty).toBe(true)
		expect(insight.safetyWarnings).toContain("Has uncommitted changes")
	})

	it("identifies untracked files", async () => {
		vi.mocked(execa).mockImplementation(async (_cmd, args) => {
			if (args?.[0] === "status") {
				return { stdout: "?? new-file.ts" } as never
			}
			return { stdout: "" } as never
		})

		const insight = await inspectWorktree(testDir, "feature")

		expect(insight.hasUntracked).toBe(true)
		expect(insight.safetyWarnings).toContain("Has untracked files")
	})

	it("identifies unpushed commits", async () => {
		vi.mocked(execa).mockImplementation(async (_cmd, args) => {
			const arg0 = args?.[0]
			const arg3 = args?.[3]
			if (arg0 === "status") {
				return { stdout: "" } as never
			}
			if (arg0 === "rev-parse" && arg3 === "@{u}") {
				return { stdout: "origin/feature" } as never
			}
			if (arg0 === "rev-list") {
				return { stdout: "3" } as never
			}
			return { stdout: "" } as never
		})

		const insight = await inspectWorktree(testDir, "feature")

		expect(insight.unpushedCount).toBe(3)
		expect(insight.safetyWarnings).toContain("3 unpushed commits")
	})

	it("identifies unreachable detached HEAD commits", async () => {
		vi.mocked(execa).mockImplementation(async (_cmd, args) => {
			const arg0 = args?.[0]
			const arg1 = args?.[1]
			if (arg0 === "status") {
				return { stdout: "" } as never
			}
			if (arg0 === "branch" && arg1 === "--contains") {
				return { stdout: "* (HEAD detached at abc1234)" } as never
			}
			return { stdout: "" } as never
		})

		const insight = await inspectWorktree(testDir, undefined, true)

		expect(insight.isDetachedUnreachable).toBe(true)
		expect(insight.safetyWarnings).toContain(
			"Detached HEAD commits are not reachable from any branch",
		)
	})

	it("identifies reachable detached HEAD commits", async () => {
		vi.mocked(execa).mockImplementation(async (_cmd, args) => {
			const arg0 = args?.[0]
			const arg1 = args?.[1]
			if (arg0 === "status") {
				return { stdout: "" } as never
			}
			if (arg0 === "branch" && arg1 === "--contains") {
				return {
					stdout: "* (HEAD detached at abc1234)\n  main",
				} as never
			}
			return { stdout: "" } as never
		})

		const insight = await inspectWorktree(testDir, undefined, true)

		expect(insight.isDetachedUnreachable).toBe(false)
		expect(insight.safetyWarnings).not.toContain(
			"Detached HEAD commits are not reachable from any branch",
		)
	})
})
