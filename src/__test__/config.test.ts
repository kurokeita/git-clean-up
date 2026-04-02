import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
	CONFIG_FILE_NAME,
	DEFAULT_CLEANUP_POLICY,
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

		const loaded = await loadCleanupPolicy(directory)

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

	it("rejects unsupported config keys", () => {
		expect(() =>
			parseCleanupPolicy({
				unknownKey: true,
			}),
		).toThrow("unsupported config key: unknownKey")
	})

	it("rejects invalid cleanup categories", () => {
		expect(() =>
			parseCleanupPolicy({
				includeCategories: ["branch", "invalid"],
			}),
		).toThrow("includeCategories contains unsupported category: invalid")
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
})
