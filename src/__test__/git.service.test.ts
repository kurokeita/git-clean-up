import { execa } from "execa"
import { describe, expect, it, vi } from "vitest"
import { GitService } from "../git.service"

vi.mock("execa")

describe(GitService.name, () => {
	const gitService = new GitService()

	// Helper to create a result that matches the structure expected by execa
	const mockResult = (stdout: string) => {
		return {
			stdout,
			stderr: "",
			command: "",
			escapedCommand: "",
			exitCode: 0,
			failed: false,
			timedOut: false,
			isCanceled: false,
			isTerminated: false,
			isMaxBuffer: false,
			cwd: "",
			durationMs: 0,
			pipedFrom: [],
		}
	}

	describe("getMergedBranches", () => {
		it("should return branches that are merged into the target branch", async () => {
			vi.mocked(execa).mockResolvedValue(
				// biome-ignore lint/suspicious/noExplicitAny: mock
				mockResult("  feature-1\n  feature-2\n") as any,
			)

			const merged = await gitService.getMergedBranches("main")
			expect(merged).toContain("feature-1")
			expect(merged).toContain("feature-2")
			expect(merged).not.toContain("main")
		})
	})

	describe("getGoneBranches", () => {
		it("should return branches whose upstream is gone", async () => {
			vi.mocked(execa).mockResolvedValue(
				// biome-ignore lint/suspicious/noExplicitAny: mock
				mockResult("feature-gone [gone]\nmain [ahead 1]\n") as any,
			)

			const gone = await gitService.getGoneBranches()
			expect(gone).toEqual(["feature-gone"])
		})
	})

	describe("pruneRemotes", () => {
		it("should call git fetch --prune", async () => {
			// biome-ignore lint/suspicious/noExplicitAny: mock
			vi.mocked(execa).mockResolvedValue(mockResult("") as any)
			await gitService.pruneRemotes()
			expect(execa).toHaveBeenCalledWith("git", ["fetch", "--prune"])
		})
	})

	describe("getAllLocalBranches", () => {
		it("should return local branches excluding current and those in worktrees", async () => {
			vi.mocked(execa).mockImplementation((_cmd, args) => {
				const actualArgs = args as string[]
				if (actualArgs?.[0] === "branch") {
					return Promise.resolve(
						mockResult("feature-1  \nfeature-2 *\nmain  \n"),
						// biome-ignore lint/suspicious/noExplicitAny: mock
					) as any
				}
				if (actualArgs?.[0] === "worktree") {
					return Promise.resolve(
						mockResult("branch refs/heads/feature-1\n"),
						// biome-ignore lint/suspicious/noExplicitAny: mock
					) as any
				}
				// biome-ignore lint/suspicious/noExplicitAny: mock
				return Promise.resolve(mockResult("")) as any
			})

			const branches = await gitService.getAllLocalBranches()
			// feature-1 is in worktree, feature-2 is current (*)
			expect(branches).toEqual(["main"])
		})
	})

	describe("identifySquashedBranches", () => {
		it("should identify branches that were squash-merged", async () => {
			vi.mocked(execa).mockImplementation((_cmd, args) => {
				const actualArgs = args as string[]
				if (actualArgs?.[0] === "merge-base")
					// biome-ignore lint/suspicious/noExplicitAny: mock
					return Promise.resolve(mockResult("base-sha")) as any
				if (actualArgs?.[0] === "rev-parse")
					// biome-ignore lint/suspicious/noExplicitAny: mock
					return Promise.resolve(mockResult("tree-sha")) as any
				if (actualArgs?.[0] === "commit-tree")
					// biome-ignore lint/suspicious/noExplicitAny: mock
					return Promise.resolve(mockResult("tmp-sha")) as any
				if (actualArgs?.[0] === "cherry")
					// biome-ignore lint/suspicious/noExplicitAny: mock
					return Promise.resolve(mockResult("- some-sha")) as any
				// biome-ignore lint/suspicious/noExplicitAny: mock
				return Promise.resolve(mockResult("")) as any
			})

			const squashed = await gitService.identifySquashedBranches("main", [
				"feat-squashed",
			])
			expect(squashed).toEqual(["feat-squashed"])
		})

		it("should skip branches that were not squash-merged", async () => {
			vi.mocked(execa).mockImplementation((_cmd, args) => {
				const actualArgs = args as string[]
				if (actualArgs?.[0] === "cherry")
					// biome-ignore lint/suspicious/noExplicitAny: mock
					return Promise.resolve(mockResult("+ some-sha")) as any
				// biome-ignore lint/suspicious/noExplicitAny: mock
				return Promise.resolve(mockResult("some-sha")) as any
			})

			const squashed = await gitService.identifySquashedBranches("main", [
				"feat-not-squashed",
			])
			expect(squashed).toEqual([])
		})
	})
})
