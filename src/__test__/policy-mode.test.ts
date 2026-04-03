import { mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execa } from "execa"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runApp } from "../index"
import * as ui from "../ui"

vi.mock("execa")
vi.mock("../ui", async () => {
	const actual = await vi.importActual("../ui")
	return {
		...actual,
		createSpinner: vi.fn(() => ({
			start: vi.fn(),
			stop: vi.fn(),
			message: vi.fn(),
			cancel: vi.fn(),
			error: vi.fn(),
			clear: vi.fn(),
			isCancelled: false,
		})),
		showWelcome: vi.fn(),
		showDone: vi.fn(),
		showCancel: vi.fn(),
		showNote: vi.fn(),
		showSummary: vi.fn(),
		serializeFindings: vi.fn(() => "[]"),
	}
})

describe("CI / Policy Mode", () => {
	const testDir = join(tmpdir(), "git-clean-up-test-policy-mode")
	const repoRoot = join(testDir, "repo")

	beforeEach(async () => {
		await mkdir(testDir, { recursive: true })
		await mkdir(repoRoot, { recursive: true })

		// Create a local config to prevent interactive prompts
		await writeFile(
			join(repoRoot, ".git-clean-up.json"),
			JSON.stringify({ includeCategories: ["branch"] }),
		)

		vi.mocked(execa).mockImplementation(async (_cmd, args) => {
			const arg0 = args?.[0]
			const arg1 = args?.[1]
			if (arg0 === "rev-parse" && arg1 === "--show-toplevel") {
				return { stdout: repoRoot } as never
			}
			if (arg0 === "symbolic-ref") {
				return { stdout: "refs/heads/main" } as never
			}
			if (arg0 === "rev-parse" && arg1 === "--verify") {
				return {} as never
			}
			return { stdout: "" } as never
		})
	})

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true })
		vi.clearAllMocks()
	})

	it("outputs summary when --summary is used", async () => {
		process.argv = ["node", "git-clean-up", "scan", "--summary"]

		// Mock collectFindings to return some findings
		// We'll mock the GitService methods inside runApp indirectly via execa
		// But it's easier to mock the whole GitService.
		// Actually index.test.ts mocks GitService. Let's stick to simple validation for now.

		await runApp()
		expect(vi.mocked(ui.showSummary)).toHaveBeenCalled()
	})

	it("exits with 1 when max-findings is exceeded", async () => {
		const exitSpy = vi
			.spyOn(process, "exit")
			.mockImplementation(() => undefined as never)

		// To make it return findings, we need to mock git commands or the service.
		// For this test, let's just verify the logic in index.ts if we can.

		// Actually, testing the exit code directly in runApp is hard without deep mocks.
		// I'll trust the logic if unit tests for checkPolicyViolation existed,
		// but since it's private in index.ts, I'll rely on the implementation review.

		// Wait, I can test if runApp calls process.exit(1)
		process.argv = [
			"node",
			"git-clean-up",
			"scan",
			"--max-findings",
			"0",
			"--summary",
		]

		// We need some findings to trigger the failure.
		// Let's mock git branch to return a "merged" branch.
		vi.mocked(execa).mockImplementation(async (_cmd, args) => {
			const arg0 = args?.[0]
			const arg1 = args?.[1]
			if (arg0 === "rev-parse" && arg1 === "--show-toplevel")
				return { stdout: repoRoot } as never
			if (arg0 === "branch" && arg1 === "--merged")
				return { stdout: "  feature-merged" } as never
			if (arg0 === "worktree" && arg1 === "list")
				return { stdout: "path/to/repo main" } as never
			if (arg0 === "for-each-ref") return { stdout: "" } as never
			return { stdout: "" } as never
		})

		await runApp()
		expect(exitSpy).toHaveBeenCalledWith(1)
		exitSpy.mockRestore()
	})
})
