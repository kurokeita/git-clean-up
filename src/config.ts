import { readFile } from "node:fs/promises"
import { join } from "node:path"
import {
	DEFAULT_PROTECTED_BRANCHES,
	matchesBranchPattern,
} from "./branch-protection"
import type {
	CleanupCategory,
	CleanupPolicy,
	ResolvedCleanupPolicy,
} from "./cleanup.types"

export const CONFIG_FILE_NAME = ".git-clean-up.json"

const VALID_CATEGORIES: CleanupCategory[] = ["branch", "stash", "worktree"]
const VALID_KEYS = new Set([
	"protectedBranches",
	"includeCategories",
	"stashAgeDays",
	"branchInactiveDays",
	"divergedAheadCount",
	"divergedBehindCount",
	"branchExcludePatterns",
])

export const DEFAULT_CLEANUP_POLICY: ResolvedCleanupPolicy = {
	branchExcludePatterns: [],
	branchInactiveDays: 90,
	divergedAheadCount: 10,
	divergedBehindCount: 10,
	includeCategories: [...VALID_CATEGORIES],
	protectedBranches: [...DEFAULT_PROTECTED_BRANCHES],
	stashAgeDays: 30,
}

export interface LoadedCleanupPolicy {
	configPath?: string
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
		divergedAheadCount:
			config.divergedAheadCount ?? DEFAULT_CLEANUP_POLICY.divergedAheadCount,
		divergedBehindCount:
			config.divergedBehindCount ?? DEFAULT_CLEANUP_POLICY.divergedBehindCount,
		includeCategories:
			config.includeCategories ?? DEFAULT_CLEANUP_POLICY.includeCategories,
		protectedBranches: [...new Set(protectedBranches)],
		stashAgeDays: config.stashAgeDays ?? DEFAULT_CLEANUP_POLICY.stashAgeDays,
	}
}

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

	return policy
}

export async function loadCleanupPolicy(
	repositoryRoot: string,
): Promise<LoadedCleanupPolicy> {
	const configPath = join(repositoryRoot, CONFIG_FILE_NAME)

	try {
		const fileContents = await readFile(configPath, "utf8")
		const parsed = JSON.parse(fileContents) as unknown
		return {
			configPath,
			policy: resolveCleanupPolicy(parseCleanupPolicy(parsed)),
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {
				policy: resolveCleanupPolicy(),
			}
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
