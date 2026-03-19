import { execa } from "execa"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GitService } from "../git.service"

vi.mock("execa")

describe("GitService.getDefaultBranch", () => {
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

	it("uses origin HEAD when the remote default branch is available", async () => {
		vi.mocked(execa).mockImplementation((_cmd, args) => {
			const actualArgs = args as string[]

			if (
				actualArgs[0] === "symbolic-ref" &&
				actualArgs[1] === "refs/remotes/origin/HEAD"
			) {
				return Promise.resolve(mockResult("refs/remotes/origin/master\n"))
			}

			return Promise.resolve(mockResult(""))
		})

		await expect(gitService.getDefaultBranch()).resolves.toBe("origin/master")
	})

	it("falls back to the local main branch when origin HEAD is unavailable", async () => {
		vi.mocked(execa).mockImplementation((_cmd, args) => {
			const actualArgs = args as string[]

			if (
				actualArgs[0] === "symbolic-ref" &&
				actualArgs[1] === "refs/remotes/origin/HEAD"
			) {
				return Promise.reject(
					new Error(
						"fatal: ref refs/remotes/origin/HEAD is not a symbolic ref",
					),
				)
			}

			if (
				actualArgs[0] === "show-ref" &&
				actualArgs[1] === "--verify" &&
				actualArgs[2] === "--quiet" &&
				actualArgs[3] === "refs/heads/main"
			) {
				return Promise.resolve(mockResult(""))
			}

			if (
				actualArgs[0] === "show-ref" &&
				actualArgs[1] === "--verify" &&
				actualArgs[2] === "--quiet" &&
				actualArgs[3] === "refs/heads/master"
			) {
				return Promise.reject(new Error("master missing"))
			}

			return Promise.resolve(mockResult(""))
		})

		await expect(gitService.getDefaultBranch()).resolves.toBe("main")
	})

	it("falls back to local master when main is missing", async () => {
		vi.mocked(execa).mockImplementation((_cmd, args) => {
			const actualArgs = args as string[]

			if (
				actualArgs[0] === "symbolic-ref" &&
				actualArgs[1] === "refs/remotes/origin/HEAD"
			) {
				return Promise.reject(new Error("no origin head"))
			}

			if (
				actualArgs[0] === "show-ref" &&
				actualArgs[1] === "--verify" &&
				actualArgs[2] === "--quiet" &&
				actualArgs[3] === "refs/heads/main"
			) {
				return Promise.reject(new Error("main missing"))
			}

			if (
				actualArgs[0] === "show-ref" &&
				actualArgs[1] === "--verify" &&
				actualArgs[2] === "--quiet" &&
				actualArgs[3] === "refs/heads/master"
			) {
				return Promise.resolve(mockResult(""))
			}

			return Promise.resolve(mockResult(""))
		})

		await expect(gitService.getDefaultBranch()).resolves.toBe("master")
	})

	it("returns the current branch when main and master are both missing", async () => {
		vi.mocked(execa).mockImplementation((_cmd, args) => {
			const actualArgs = args as string[]

			if (
				actualArgs[0] === "symbolic-ref" &&
				actualArgs[1] === "refs/remotes/origin/HEAD"
			) {
				return Promise.reject(new Error("no origin head"))
			}

			if (
				actualArgs[0] === "show-ref" &&
				actualArgs[1] === "--verify" &&
				actualArgs[2] === "--quiet"
			) {
				return Promise.reject(new Error("branch missing"))
			}

			if (actualArgs[0] === "branch" && actualArgs[1] === "--show-current") {
				return Promise.resolve(mockResult("release/1.x\n"))
			}

			return Promise.resolve(mockResult(""))
		})

		await expect(gitService.getDefaultBranch()).resolves.toBe("release/1.x")
	})
})
