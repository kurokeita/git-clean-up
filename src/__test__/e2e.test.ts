import fs from "node:fs/promises"
import path from "node:path"
import { execa } from "execa"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

describe("E2E", () => {
	const testRepoPath = path.join(process.cwd(), "test-repo-e2e")
	const worktreePath = path.join(process.cwd(), "test-repo-e2e-worktree")
	const entryPath = path.join(process.cwd(), "dist/index.js")

	const runCli = async (...args: string[]) =>
		execa("node", [entryPath, ...args], {
			cwd: testRepoPath,
			env: { ...process.env, CI: "true" },
		})

	beforeAll(async () => {
		await execa("pnpm", ["run", "build"], {
			cwd: process.cwd(),
		})

		await fs.mkdir(testRepoPath, { recursive: true })
		const git = async (...args: string[]) =>
			execa("git", args, { cwd: testRepoPath })

		await git("init", "-b", "main")
		await git("config", "user.email", "test@example.com")
		await git("config", "user.name", "Test User")

		await fs.writeFile(path.join(testRepoPath, "file.txt"), "hello")
		await git("add", ".")
		await git("commit", "-m", "initial commit")

		await git("checkout", "-b", "merged-branch")
		await git("checkout", "main")
		await git("merge", "merged-branch")

		await git("checkout", "-b", "cleanup-branch")
		await git("checkout", "main")
		await git("merge", "cleanup-branch")

		await git("checkout", "-b", "unmerged-branch")
		await fs.writeFile(path.join(testRepoPath, "other.txt"), "world")
		await git("add", ".")
		await git("commit", "-m", "unmerged work")
		await git("stash", "push", "-m", "shared message")
		await fs.writeFile(path.join(testRepoPath, "other.txt"), "world-again")
		await git("stash", "push", "-m", "shared message")
		await git("checkout", "main")

		await git("worktree", "add", worktreePath, "merged-branch")
		await fs.rm(worktreePath, { recursive: true, force: true })
	})

	afterAll(async () => {
		await fs.rm(testRepoPath, { recursive: true, force: true })
		await fs.rm(worktreePath, { recursive: true, force: true })
	})

	it("returns grouped findings in json scan mode", async () => {
		const { stdout } = await runCli(
			"scan",
			"--json",
			"--include",
			"branches,stashes,worktrees",
			"--age-days",
			"0",
		)

		expect(stdout).toContain('"category": "branch"')
		expect(stdout).toContain('"category": "stash"')
		expect(stdout).toContain('"category": "worktree"')
		expect(stdout).toContain("merged-branch")
		expect(stdout).toContain(worktreePath)
	})

	it("previews cleanup actions in clean mode without apply", async () => {
		const { stdout } = await runCli("clean", "--include", "branches", "--all")

		expect(stdout).toContain("Dry run")
		expect(stdout).toContain("git branch -D cleanup-branch")
	})

	it("applies cleanup actions when apply is enabled", async () => {
		await runCli("clean", "--include", "branches", "--all", "--apply")

		const { stdout } = await execa(
			"git",
			["branch", "--list", "cleanup-branch"],
			{
				cwd: testRepoPath,
			},
		)

		expect(stdout.trim()).toBe("")
	})
})
