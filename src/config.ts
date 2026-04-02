import { watch } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import {
	DEFAULT_PROTECTED_BRANCHES,
	matchesBranchPattern,
} from "./branch-protection"
import type {
	CleanupCategory,
	CleanupPolicy,
	ResolvedCleanupPolicy,
} from "./cleanup.types"

/** Filename for repo-local cleanup policy configuration. */
export const CONFIG_FILE_NAME = ".git-clean-up.json"
export const CONFIG_SCHEMA_URL =
	"https://github.com/kurokeita/git-clean-up/config-schema.json"

const VALID_CATEGORIES: CleanupCategory[] = ["branch", "stash", "worktree"]
const VALID_KEYS = new Set([
	"$schema",
	"protectedBranches",
	"includeCategories",
	"stashAgeDays",
	"defaultTargetBranch",
	"branchInactiveDays",
	"divergedAheadCount",
	"divergedBehindCount",
	"branchExcludePatterns",
	"skipPrune",
])

/** Built-in defaults used when no repo-local config exists. */
export const DEFAULT_CLEANUP_POLICY: ResolvedCleanupPolicy = {
	branchExcludePatterns: [],
	branchInactiveDays: 90,
	divergedAheadCount: 10,
	divergedBehindCount: 10,
	includeCategories: [...VALID_CATEGORIES],
	protectedBranches: [...DEFAULT_PROTECTED_BRANCHES],
	skipPrune: false,
	stashAgeDays: 30,
}

/** Result of loading cleanup policy from disk. */
export interface LoadedCleanupPolicy {
	/** Effective config path by precedence: local if present, else global. */
	configPath?: string
	/** Absolute path to the repo-local config file, if present. */
	localConfigPath?: string
	/** Absolute path to the global config file, if present. */
	globalConfigPath?: string
	/** Config path that supplied defaultTargetBranch, if any. */
	defaultTargetBranchSourcePath?: string
	/** The resolved policy with all fields populated. */
	policy: ResolvedCleanupPolicy
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function ensureStringArray(value: unknown, key: string): string[] {
	if (!Array.isArray(value)) {
		throw new Error(`${key} must be an array of strings`)
	}

	return value.map((entry, index) => {
		if (typeof entry !== "string" || entry.trim() === "") {
			throw new Error(`${key}[${index}] must be a non-empty string`)
		}

		return entry.trim()
	})
}

function ensurePositiveInteger(value: unknown, key: string): number {
	if (!Number.isInteger(value) || (value as number) < 0) {
		throw new Error(`${key} must be a non-negative integer`)
	}

	return value as number
}

function ensureOptionalString(value: unknown): string {
	if (typeof value !== "string") {
		return ""
	}

	return value.trim()
}

function parseCategories(value: unknown): CleanupCategory[] {
	const categories = ensureStringArray(value, "includeCategories").map(
		(entry) => {
			if (!VALID_CATEGORIES.includes(entry as CleanupCategory)) {
				throw new Error(
					`includeCategories contains unsupported category: ${entry}`,
				)
			}

			return entry as CleanupCategory
		},
	)

	return categories.length > 0
		? [...new Set(categories)]
		: [...VALID_CATEGORIES]
}

/**
 * Merges a partial user config with built-in defaults.
 * Protected branches extend (not replace) the default list.
 */
export function resolveCleanupPolicy(
	config: CleanupPolicy = {},
): ResolvedCleanupPolicy {
	const protectedBranches = [
		...DEFAULT_CLEANUP_POLICY.protectedBranches,
		...(config.protectedBranches ?? []),
	]

	return {
		branchExcludePatterns: [...(config.branchExcludePatterns ?? [])],
		branchInactiveDays:
			config.branchInactiveDays ?? DEFAULT_CLEANUP_POLICY.branchInactiveDays,
		defaultTargetBranch: config.defaultTargetBranch,
		divergedAheadCount:
			config.divergedAheadCount ?? DEFAULT_CLEANUP_POLICY.divergedAheadCount,
		divergedBehindCount:
			config.divergedBehindCount ?? DEFAULT_CLEANUP_POLICY.divergedBehindCount,
		includeCategories:
			config.includeCategories ?? DEFAULT_CLEANUP_POLICY.includeCategories,
		protectedBranches: [...new Set(protectedBranches)],
		skipPrune: config.skipPrune ?? DEFAULT_CLEANUP_POLICY.skipPrune,
		stashAgeDays: config.stashAgeDays ?? DEFAULT_CLEANUP_POLICY.stashAgeDays,
	}
}

/**
 * Validates and extracts a CleanupPolicy from parsed JSON.
 * Rejects unknown keys and validates types/ranges for each field.
 * @throws Error if the input is not a valid policy object.
 */
export function parseCleanupPolicy(raw: unknown): CleanupPolicy {
	if (!isPlainObject(raw)) {
		throw new Error("cleanup policy must be a JSON object")
	}

	for (const key of Object.keys(raw)) {
		if (!VALID_KEYS.has(key)) {
			throw new Error(`unsupported config key: ${key}`)
		}
	}

	const policy: CleanupPolicy = {}

	if ("protectedBranches" in raw && raw.protectedBranches !== undefined) {
		policy.protectedBranches = ensureStringArray(
			raw.protectedBranches,
			"protectedBranches",
		)
	}

	if ("includeCategories" in raw && raw.includeCategories !== undefined) {
		policy.includeCategories = parseCategories(raw.includeCategories)
	}

	if ("stashAgeDays" in raw && raw.stashAgeDays !== undefined) {
		policy.stashAgeDays = ensurePositiveInteger(
			raw.stashAgeDays,
			"stashAgeDays",
		)
	}

	if ("defaultTargetBranch" in raw && raw.defaultTargetBranch !== undefined) {
		policy.defaultTargetBranch = ensureOptionalString(raw.defaultTargetBranch)
	}

	if ("branchInactiveDays" in raw && raw.branchInactiveDays !== undefined) {
		policy.branchInactiveDays = ensurePositiveInteger(
			raw.branchInactiveDays,
			"branchInactiveDays",
		)
	}

	if ("divergedAheadCount" in raw && raw.divergedAheadCount !== undefined) {
		policy.divergedAheadCount = ensurePositiveInteger(
			raw.divergedAheadCount,
			"divergedAheadCount",
		)
	}

	if ("divergedBehindCount" in raw && raw.divergedBehindCount !== undefined) {
		policy.divergedBehindCount = ensurePositiveInteger(
			raw.divergedBehindCount,
			"divergedBehindCount",
		)
	}

	if (
		"branchExcludePatterns" in raw &&
		raw.branchExcludePatterns !== undefined
	) {
		const patterns = ensureStringArray(
			raw.branchExcludePatterns,
			"branchExcludePatterns",
		)

		for (const pattern of patterns) {
			matchesBranchPattern("validation-target", pattern)
		}

		policy.branchExcludePatterns = patterns
	}

	if ("skipPrune" in raw && raw.skipPrune !== undefined) {
		if (typeof raw.skipPrune !== "boolean") {
			throw new Error("skipPrune must be a boolean")
		}
		policy.skipPrune = raw.skipPrune
	}

	return policy
}

/** Returns the global config path (`~/.git-clean-up.json`) for a home directory. */
export function getGlobalConfigPath(homeDirectory = homedir()): string {
	return join(homeDirectory, CONFIG_FILE_NAME)
}

/** Returns the repo-local config path for a repository root. */
export function getLocalConfigPath(repositoryRoot: string): string {
	return join(repositoryRoot, CONFIG_FILE_NAME)
}

async function readCleanupPolicyFile(
	configPath: string,
): Promise<CleanupPolicy> {
	try {
		const fileContents = await readFile(configPath, "utf8")
		const parsed = JSON.parse(fileContents) as unknown
		return parseCleanupPolicy(parsed)
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw error
		}

		if (error instanceof SyntaxError) {
			throw new Error(`Invalid ${CONFIG_FILE_NAME}: ${error.message}`)
		}

		if (error instanceof Error) {
			throw new Error(`Invalid ${CONFIG_FILE_NAME}: ${error.message}`)
		}

		throw error
	}
}

/** Creates a cleanup policy config file, including parent directories if needed. */
export async function initializeCleanupPolicyConfig(
	configPath: string,
	policy: CleanupPolicy = DEFAULT_CLEANUP_POLICY,
): Promise<void> {
	await mkdir(dirname(configPath), { recursive: true })
	await writeFile(
		`${configPath}`,
		`${JSON.stringify({ $schema: CONFIG_SCHEMA_URL, ...policy }, null, 2)}\n`,
		"utf8",
	)
}

/** Applies a partial update to an existing cleanup policy file. */
export async function updateCleanupPolicyFile(
	configPath: string,
	updates: Partial<CleanupPolicy>,
): Promise<void> {
	const currentPolicy = await readCleanupPolicyFile(configPath)
	await initializeCleanupPolicyConfig(configPath, {
		...currentPolicy,
		...updates,
	})
}

/** Waits for a config file change before attempting to reload it. */
export async function waitForConfigChange(configPath: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		let timer: NodeJS.Timeout | undefined
		const watcher = watch(configPath, (eventType, _filename) => {
			if (eventType !== "change" && eventType !== "rename") {
				return
			}

			if (timer) {
				clearTimeout(timer)
			}

			timer = setTimeout(() => {
				watcher.close()
				resolve()
			}, 100)
		})

		watcher.once("error", (error) => {
			if (timer) {
				clearTimeout(timer)
			}
			watcher.close()
			reject(error)
		})
	})
}

/**
 * Loads cleanup policy using the precedence base of defaults <- global <- local.
 * CLI flags are applied later by the application entry point.
 * @throws Error if the config file exists but is malformed.
 */
export async function loadCleanupPolicy(
	repositoryRoot: string,
	homeDirectory = homedir(),
): Promise<LoadedCleanupPolicy> {
	const localConfigPath = getLocalConfigPath(repositoryRoot)
	const globalConfigPath = getGlobalConfigPath(homeDirectory)

	let globalPolicy: CleanupPolicy = {}
	let localPolicy: CleanupPolicy = {}
	let hasGlobalConfig = false
	let hasLocalConfig = false

	try {
		globalPolicy = await readCleanupPolicyFile(globalConfigPath)
		hasGlobalConfig = true
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error
		}
	}

	try {
		localPolicy = await readCleanupPolicyFile(localConfigPath)
		hasLocalConfig = true
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error
		}
	}

	const mergedPolicy = resolveCleanupPolicy({
		...globalPolicy,
		...localPolicy,
		protectedBranches: [
			...(globalPolicy.protectedBranches ?? []),
			...(localPolicy.protectedBranches ?? []),
		],
	})

	const defaultTargetBranchSourcePath =
		localPolicy.defaultTargetBranch !== undefined
			? localConfigPath
			: globalPolicy.defaultTargetBranch !== undefined
				? globalConfigPath
				: undefined

	return {
		configPath: hasLocalConfig
			? localConfigPath
			: hasGlobalConfig
				? globalConfigPath
				: undefined,
		defaultTargetBranchSourcePath,
		globalConfigPath: hasGlobalConfig ? globalConfigPath : undefined,
		localConfigPath: hasLocalConfig ? localConfigPath : undefined,
		policy: mergedPolicy,
	}
}
