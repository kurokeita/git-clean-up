import { execa } from "execa"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GitService } from "../git.service"

vi.mock("execa")

describe(GitService.name, () => {
	const gitService = new GitService()
	type ExecaResult = Awaited<ReturnType<typeof execa>>

	const mockResult = (stdout: string): ExecaResult =>
		({
			command: "",
			cwd: "",
			durationMs: 0,
			escapedCommand: "",
			exitCode: 0,
			failed: false,
			isCanceled: false,
			isMaxBuffer: false,
			isTerminated: false,
			pipedFrom: [],
			stderr: "",
			stdout,
			timedOut: false,
		}) as ExecaResult

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("pruneRemotes", () => {
		it("calls git fetch --prune", async () => {
			vi.mocked(execa).mockResolvedValue(mockResult(""))

			await gitService.pruneRemotes()

			expect(execa).toHaveBeenCalledWith("git", ["fetch", "--prune"])
		})
	})

	describe("getBranchFindings", () => {
		it("returns merged, gone, missing-upstream, and long-diverged branches", async () => {
			vi.mocked(execa).mockImplementation((_cmd, args) => {
				const actualArgs = args as string[]
				if (actualArgs[0] === "branch" && actualArgs[1] === "--merged") {
					return Promise.resolve(mockResult("  feature-merged\n"))
				}
				if (actualArgs[0] === "for-each-ref") {
					return Promise.resolve(
						mockResult(
							[
								"feature-gone [gone]",
								"feature-no-upstream ",
								"main origin/main",
								"feature-diverged origin/feature-diverged",
							].join("\n"),
						),
					)
				}
				if (actualArgs[0] === "worktree") {
					return Promise.resolve(mockResult("branch refs/heads/main\n"))
				}
				if (actualArgs[0] === "cherry") {
					return Promise.resolve(mockResult("+ commit"))
				}
				if (actualArgs[0] === "merge-base" || actualArgs[0] === "rev-parse") {
					return Promise.resolve(mockResult("sha"))
				}
				if (actualArgs[0] === "commit-tree") {
					return Promise.resolve(mockResult("tmp-sha"))
				}
				if (actualArgs[0] === "rev-list") {
					return Promise.resolve(mockResult("18\t14"))
				}
				return Promise.resolve(mockResult(""))
			})

			const findings = await gitService.getBranchFindings({
				ageDays: 30,
				targetBranch: "main",
			})

			expect(findings.map((finding) => finding.id)).toEqual(
				expect.arrayContaining([
					"branch:feature-merged:merged",
					"branch:feature-gone:gone",
					"branch:feature-no-upstream:no-upstream",
					"branch:feature-diverged:long-diverged",
				]),
			)
		})

		it("does not double-label no-upstream branches as merged", async () => {
			vi.mocked(execa).mockImplementation((_cmd, args) => {
				const actualArgs = args as string[]
				if (actualArgs[0] === "branch" && actualArgs[1] === "--merged") {
					return Promise.resolve(mockResult("  feature-no-upstream\n"))
				}
				if (actualArgs[0] === "for-each-ref") {
					return Promise.resolve(
						mockResult("feature-no-upstream \nmain origin/main"),
					)
				}
				if (actualArgs[0] === "worktree") {
					return Promise.resolve(mockResult("branch refs/heads/main\n"))
				}
				if (
					actualArgs[0] === "merge-base" ||
					actualArgs[0] === "rev-parse" ||
					actualArgs[0] === "commit-tree" ||
					actualArgs[0] === "cherry" ||
					actualArgs[0] === "rev-list"
				) {
					return Promise.resolve(mockResult(""))
				}
				return Promise.resolve(mockResult(""))
			})

			const findings = await gitService.getBranchFindings({
				ageDays: 30,
				targetBranch: "main",
			})

			expect(findings.map((finding) => finding.id)).toEqual([
				"branch:feature-no-upstream:no-upstream",
			])
		})

		it("does not report protected branches or active worktree branches", async () => {
			vi.mocked(execa).mockImplementation((_cmd, args) => {
				const actualArgs = args as string[]
				if (actualArgs[0] === "branch" && actualArgs[1] === "--merged") {
					return Promise.resolve(mockResult("  main\n  release/demo\n"))
				}
				if (actualArgs[0] === "for-each-ref") {
					return Promise.resolve(mockResult("release/demo origin/release/demo"))
				}
				if (actualArgs[0] === "worktree") {
					return Promise.resolve(
						mockResult(
							"branch refs/heads/release/demo\nbranch refs/heads/main\n",
						),
					)
				}
				if (actualArgs[0] === "rev-list") {
					return Promise.resolve(mockResult("0\t0"))
				}
				if (
					actualArgs[0] === "merge-base" ||
					actualArgs[0] === "rev-parse" ||
					actualArgs[0] === "commit-tree" ||
					actualArgs[0] === "cherry"
				) {
					return Promise.resolve(mockResult(""))
				}
				return Promise.resolve(mockResult(""))
			})

			const findings = await gitService.getBranchFindings({
				ageDays: 30,
				targetBranch: "main",
			})

			expect(findings).toEqual([])
		})
	})

	describe("getStashFindings", () => {
		it("returns old, duplicate-message, and stale WIP stashes", async () => {
			const oldTimestamp = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 45
			const freshTimestamp = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 2

			vi.mocked(execa).mockResolvedValue(
				mockResult(
					[
						`stash@{0}|${oldTimestamp}|WIP on main: old work`,
						`stash@{1}|${freshTimestamp}|shared message`,
						`stash@{2}|${freshTimestamp}|shared message`,
					].join("\n"),
				),
			)

			const findings = await gitService.getStashFindings(30)

			expect(findings.map((finding) => finding.id)).toEqual(
				expect.arrayContaining([
					"stash:stash@{0}:old",
					"stash:stash@{0}:stale-wip",
					"stash:stash@{1}:duplicate-message",
					"stash:stash@{2}:duplicate-message",
				]),
			)
		})
	})

	describe("getWorktreeFindings", () => {
		it("returns missing-path, detached-head, protected, and stale-branch worktrees", async () => {
			vi.mocked(execa).mockImplementation((_cmd, args) => {
				const actualArgs = args as string[]
				if (actualArgs[0] === "worktree") {
					return Promise.resolve(
						mockResult(
							[
								"worktree /tmp/missing",
								"branch refs/heads/feature-gone",
								"",
								"worktree /tmp/detached",
								"detached",
								"",
								"worktree /tmp/protected",
								"branch refs/heads/main",
							].join("\n"),
						),
					)
				}
				if (actualArgs[0] === "for-each-ref") {
					return Promise.resolve(
						mockResult("feature-gone [gone]\nmain origin/main"),
					)
				}
				if (actualArgs[0] === "branch" && actualArgs[1] === "--merged") {
					return Promise.resolve(mockResult("  feature-gone\n"))
				}
				if (
					actualArgs[0] === "merge-base" ||
					actualArgs[0] === "rev-parse" ||
					actualArgs[0] === "commit-tree" ||
					actualArgs[0] === "cherry" ||
					actualArgs[0] === "rev-list"
				) {
					return Promise.resolve(mockResult(""))
				}
				return Promise.resolve(mockResult(""))
			})

			const findings = await gitService.getWorktreeFindings({
				ageDays: 30,
				targetBranch: "main",
			})

			expect(findings.map((finding) => finding.id)).toEqual(
				expect.arrayContaining([
					"worktree:/tmp/missing:missing-path",
					"worktree:/tmp/detached:detached-head",
					"worktree:/tmp/protected:protected-branch",
					"worktree:/tmp/missing:stale-branch",
				]),
			)
		})

		it("does not report the primary current worktree as stale", async () => {
			const currentPath = process.cwd()
			const linkedPath = "/tmp"

			vi.mocked(execa).mockImplementation((_cmd, args) => {
				const actualArgs = args as string[]
				if (actualArgs[0] === "worktree") {
					return Promise.resolve(
						mockResult(
							[
								`worktree ${currentPath}`,
								"branch refs/heads/feature-current",
								"",
								`worktree ${linkedPath}`,
								"branch refs/heads/feature-gone",
							].join("\n"),
						),
					)
				}
				if (
					actualArgs[0] === "rev-parse" &&
					actualArgs[1] === "--show-toplevel"
				) {
					return Promise.resolve(mockResult(currentPath))
				}
				if (actualArgs[0] === "for-each-ref") {
					return Promise.resolve(
						mockResult("feature-gone [gone]\nmain origin/main"),
					)
				}
				if (actualArgs[0] === "branch" && actualArgs[1] === "--merged") {
					return Promise.resolve(mockResult("  feature-gone\n"))
				}
				if (
					(actualArgs[0] === "rev-parse" &&
						actualArgs[1] !== "--show-toplevel") ||
					actualArgs[0] === "merge-base" ||
					actualArgs[0] === "commit-tree" ||
					actualArgs[0] === "cherry" ||
					actualArgs[0] === "rev-list"
				) {
					return Promise.resolve(mockResult(""))
				}
				return Promise.resolve(mockResult(""))
			})

			const findings = await gitService.getWorktreeFindings({
				ageDays: 30,
				targetBranch: "main",
			})

			expect(findings.map((finding) => finding.id)).toEqual([
				`worktree:${linkedPath}:stale-branch`,
			])
		})
	})
})
