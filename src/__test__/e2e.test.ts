import fs from "node:fs/promises"
import path from "node:path"
import { execa } from "execa"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import packageJson from "../../package.json"

describe("E2E", () => {
	const testRepoPath = path.join(process.cwd(), "test-repo-e2e")
	const worktreePath = path.join(process.cwd(), "test-repo-e2e-worktree")
	const remoteSeedPath = path.join(process.cwd(), "test-repo-remote-seed")
	const remoteRepoPath = path.join(process.cwd(), "test-repo-remote.git")
	const remoteClonePath = path.join(process.cwd(), "test-repo-remote-clone")
	const entryPath = path.join(process.cwd(), "dist/index.js")

	const runCli = async (...args: string[]) =>
		execa("node", [entryPath, ...args], {
			cwd: testRepoPath,
			env: { ...process.env, CI: "true" },
		})

	const runRemoteCli = async (...args: string[]) =>
		execa("node", [entryPath, ...args], {
			cwd: remoteClonePath,
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

		await fs.mkdir(remoteSeedPath, { recursive: true })
		const remoteSeedGit = async (...args: string[]) =>
			execa("git", args, { cwd: remoteSeedPath })

		await remoteSeedGit("init", "-b", "main")
		await remoteSeedGit("config", "user.email", "test@example.com")
		await remoteSeedGit("config", "user.name", "Test User")
		await fs.writeFile(path.join(remoteSeedPath, "remote.txt"), "hello")
		await remoteSeedGit("add", ".")
		await remoteSeedGit("commit", "-m", "initial commit")

		await execa("git", ["clone", "--bare", remoteSeedPath, remoteRepoPath], {
			cwd: process.cwd(),
		})
		await execa("git", ["clone", remoteRepoPath, remoteClonePath], {
			cwd: process.cwd(),
		})

		const remoteCloneGit = async (...args: string[]) =>
			execa("git", args, { cwd: remoteClonePath })

		await remoteCloneGit("config", "user.email", "test@example.com")
		await remoteCloneGit("config", "user.name", "Test User")
		await remoteCloneGit("checkout", "-b", "cleanup-branch")
		await remoteCloneGit("checkout", "-b", "feature/local", "origin/main")
		await remoteCloneGit("branch", "-D", "main")
	})

	afterAll(async () => {
		await fs.rm(testRepoPath, { recursive: true, force: true })
		await fs.rm(worktreePath, { recursive: true, force: true })
		await fs.rm(remoteSeedPath, { recursive: true, force: true })
		await fs.rm(remoteRepoPath, { recursive: true, force: true })
		await fs.rm(remoteClonePath, { recursive: true, force: true })
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
		expect(() => JSON.parse(stdout)).not.toThrow()
	})

	it("prints the package version for both version flags", async () => {
		const longFlag = await runCli("--version")
		const shortFlag = await runCli("-v")

		expect(longFlag.stdout.trim()).toBe(packageJson.version)
		expect(shortFlag.stdout.trim()).toBe(packageJson.version)
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

	it("removes selected stashes when stash cleanup is applied", async () => {
		const before = await execa("git", ["stash", "list"], {
			cwd: testRepoPath,
		})
		const beforeEntries = before.stdout
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
		expect(beforeEntries.length).toBeGreaterThan(0)

		await runCli(
			"clean",
			"--include",
			"stashes",
			"--age-days",
			"0",
			"--all",
			"--apply",
		)

		const after = await execa("git", ["stash", "list"], {
			cwd: testRepoPath,
		})

		expect(after.stdout.trim()).toBe("")
	})

	it("uses origin/main when the local main branch is deleted", async () => {
		const { stdout } = await runRemoteCli(
			"scan",
			"--json",
			"--include",
			"branches",
		)

		expect(stdout).toContain('"category": "branch"')
		expect(stdout).toContain("cleanup-branch")
	})
})
