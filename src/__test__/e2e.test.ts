import fs from "node:fs/promises"
import path from "node:path"
import { execa } from "execa"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

describe("E2E", () => {
	const testRepoPath = path.join(process.cwd(), "test-repo-e2e")
	const binPath = path.join(process.cwd(), "dist/index.js")

	beforeAll(async () => {
		// Setup a real git repo for testing
		await fs.mkdir(testRepoPath, { recursive: true })
		const git = async (...args: string[]) =>
			execa("git", args, { cwd: testRepoPath })

		await git("init", "-b", "main")
		await git("config", "user.email", "test@example.com")
		await git("config", "user.name", "Test User")

		await fs.writeFile(path.join(testRepoPath, "file.txt"), "hello")
		await git("add", ".")
		await git("commit", "-m", "initial commit")

		// Create a merged branch
		await git("checkout", "-b", "merged-branch")
		await git("checkout", "main")
		await git("merge", "merged-branch")

		// Create an unmerged branch
		await git("checkout", "-b", "unmerged-branch")
		await fs.writeFile(path.join(testRepoPath, "other.txt"), "world")
		await git("add", ".")
		await git("commit", "-m", "unmerged work")
		await git("checkout", "main")
	})

	afterAll(async () => {
		await fs.rm(testRepoPath, { recursive: true, force: true })
	})

	it("should detect merged branches in dry-run mode", async () => {
		const { stdout } = await execa(
			"node",
			[binPath, "--dry-run", "--all", "--target", "main"],
			{
				cwd: testRepoPath,
				env: { ...process.env, CI: "true" },
			},
		)

		expect(stdout).toContain("merged-branch")
		expect(stdout).toContain("Dry run")
	})
})
