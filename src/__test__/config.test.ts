import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
	CONFIG_FILE_NAME,
	DEFAULT_CLEANUP_POLICY,
	initializeCleanupPolicyConfig,
	loadCleanupPolicy,
	parseCleanupPolicy,
	resolveCleanupPolicy,
} from "../config"

describe("config", () => {
	const tempDirectories: string[] = []

	afterEach(async () => {
		await Promise.all(
			tempDirectories
				.splice(0)
				.map((directory) => rm(directory, { force: true, recursive: true })),
		)
	})

	it("returns built-in defaults when no config file exists", async () => {
		const directory = await mkdtemp(join(tmpdir(), "git-clean-up-config-"))
		tempDirectories.push(directory)
		const homeDirectory = await mkdtemp(join(tmpdir(), "git-clean-up-home-"))
		tempDirectories.push(homeDirectory)

		const loaded = await loadCleanupPolicy(directory, homeDirectory)

		expect(loaded).toEqual({
			policy: DEFAULT_CLEANUP_POLICY,
		})
	})

	it("extends the built-in defaults with repo config", async () => {
		const directory = await mkdtemp(join(tmpdir(), "git-clean-up-config-"))
		tempDirectories.push(directory)
		await writeFile(
			join(directory, CONFIG_FILE_NAME),
			JSON.stringify({
				branchExcludePatterns: ["release/*"],
				divergedAheadCount: 5,
				includeCategories: ["branch", "worktree"],
				protectedBranches: ["release/*"],
			}),
		)

		const { configPath, policy } = await loadCleanupPolicy(directory)

		expect(configPath).toBe(join(directory, CONFIG_FILE_NAME))
		expect(policy.includeCategories).toEqual(["branch", "worktree"])
		expect(policy.divergedAheadCount).toBe(5)
		expect(policy.protectedBranches).toEqual(
			expect.arrayContaining(["main", "master", "develop", "dev", "release/*"]),
		)
		expect(policy.branchExcludePatterns).toEqual(["release/*"])
	})

	it("merges global config when local config is absent", async () => {
		const directory = await mkdtemp(join(tmpdir(), "git-clean-up-config-"))
		tempDirectories.push(directory)
		const homeDirectory = await mkdtemp(join(tmpdir(), "git-clean-up-home-"))
		tempDirectories.push(homeDirectory)

		await writeFile(
			join(homeDirectory, CONFIG_FILE_NAME),
			JSON.stringify({
				defaultTargetBranch: "origin/main",
				divergedAheadCount: 6,
			}),
		)

		const loaded = await loadCleanupPolicy(directory, homeDirectory)

		expect(loaded.globalConfigPath).toBe(join(homeDirectory, CONFIG_FILE_NAME))
		expect(loaded.localConfigPath).toBeUndefined()
		expect(loaded.defaultTargetBranchSourcePath).toBe(
			join(homeDirectory, CONFIG_FILE_NAME),
		)
		expect(loaded.policy.defaultTargetBranch).toBe("origin/main")
		expect(loaded.policy.divergedAheadCount).toBe(6)
	})

	it("lets local config override global config", async () => {
		const directory = await mkdtemp(join(tmpdir(), "git-clean-up-config-"))
		tempDirectories.push(directory)
		const homeDirectory = await mkdtemp(join(tmpdir(), "git-clean-up-home-"))
		tempDirectories.push(homeDirectory)

		await writeFile(
			join(homeDirectory, CONFIG_FILE_NAME),
			JSON.stringify({
				defaultTargetBranch: "origin/main",
				includeCategories: ["branch", "stash"],
			}),
		)

		await writeFile(
			join(directory, CONFIG_FILE_NAME),
			JSON.stringify({
				defaultTargetBranch: "release/1.x",
				includeCategories: ["worktree"],
			}),
		)

		const loaded = await loadCleanupPolicy(directory, homeDirectory)

		expect(loaded.localConfigPath).toBe(join(directory, CONFIG_FILE_NAME))
		expect(loaded.globalConfigPath).toBe(join(homeDirectory, CONFIG_FILE_NAME))
		expect(loaded.defaultTargetBranchSourcePath).toBe(
			join(directory, CONFIG_FILE_NAME),
		)
		expect(loaded.policy.defaultTargetBranch).toBe("release/1.x")
		expect(loaded.policy.includeCategories).toEqual(["worktree"])
	})

	it("rejects unsupported config keys", () => {
		expect(() =>
			parseCleanupPolicy({
				unknownKey: true,
			}),
		).toThrow("unsupported config key: unknownKey")
	})

	it("allows $schema for IDE schema support without treating it as policy", () => {
		expect(
			parseCleanupPolicy({
				$schema: "./config-schema.json",
				defaultTargetBranch: "origin/main",
			}),
		).toEqual({
			defaultTargetBranch: "origin/main",
		})
	})

	it("rejects invalid cleanup categories", () => {
		expect(() =>
			parseCleanupPolicy({
				includeCategories: ["branch", "invalid"],
			}),
		).toThrow("includeCategories contains unsupported category: invalid")
	})

	it("parses defaultTargetBranch as a non-empty string", () => {
		expect(
			parseCleanupPolicy({
				defaultTargetBranch: "origin/main",
			}),
		).toEqual({
			defaultTargetBranch: "origin/main",
		})

		expect(() =>
			parseCleanupPolicy({
				defaultTargetBranch: "",
			}),
		).toThrow("defaultTargetBranch must be a non-empty string")
	})

	it("resolves overrides without losing built-in protected branches", () => {
		const policy = resolveCleanupPolicy({
			protectedBranches: ["release/*"],
			stashAgeDays: 14,
		})

		expect(policy.stashAgeDays).toBe(14)
		expect(policy.protectedBranches).toEqual(
			expect.arrayContaining([
				...DEFAULT_CLEANUP_POLICY.protectedBranches,
				"release/*",
			]),
		)
	})

	it("writes a default config file for initialization", async () => {
		const directory = await mkdtemp(join(tmpdir(), "git-clean-up-config-"))
		tempDirectories.push(directory)
		const configPath = join(directory, CONFIG_FILE_NAME)

		await initializeCleanupPolicyConfig(configPath)
		const writtenConfig = JSON.parse(
			await readFile(configPath, "utf8"),
		) as Record<string, unknown>

		const loaded = await loadCleanupPolicy(directory, directory)

		expect(writtenConfig.$schema).toBe(
			"https://github.com/kurokeita/git-clean-up/config-schema.json",
		)
		expect(loaded.localConfigPath).toBe(configPath)
		expect(loaded.policy).toEqual(DEFAULT_CLEANUP_POLICY)
	})

	it("lets local config initialization inherit from a provided policy", async () => {
		const directory = await mkdtemp(join(tmpdir(), "git-clean-up-config-"))
		tempDirectories.push(directory)
		const configPath = join(directory, CONFIG_FILE_NAME)

		const customPolicy = {
			...DEFAULT_CLEANUP_POLICY,
			stashAgeDays: 99,
		}

		await initializeCleanupPolicyConfig(configPath, customPolicy)
		const loaded = await loadCleanupPolicy(directory, directory)

		expect(loaded.policy.stashAgeDays).toBe(99)
	})
})
