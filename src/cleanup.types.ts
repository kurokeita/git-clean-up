export type CleanupCategory = "branch" | "stash" | "worktree"

export type CleanupRisk = "low" | "medium" | "high"

/**
 * User-provided cleanup policy loaded from global and/or local `.git-clean-up.json` files.
 * All fields are optional — missing fields fall back to built-in defaults.
 */
export interface CleanupPolicy {
	protectedBranches?: string[]
	includeCategories?: CleanupCategory[]
	stashAgeDays?: number
	defaultTargetBranch?: string
	branchInactiveDays?: number
	divergedAheadCount?: number
	divergedBehindCount?: number
	branchExcludePatterns?: string[]
}

/**
 * Fully resolved cleanup policy with all fields populated.
 * Produced by resolving defaults and merging global/local policy inputs.
 */
export interface ResolvedCleanupPolicy {
	protectedBranches: string[]
	includeCategories: CleanupCategory[]
	stashAgeDays: number
	defaultTargetBranch?: string
	branchInactiveDays: number
	divergedAheadCount: number
	divergedBehindCount: number
	branchExcludePatterns: string[]
}

export type CleanupActionType =
	| "delete-branch"
	| "drop-stash"
	| "remove-worktree"

export interface CleanupAction {
	type: CleanupActionType
	target: string
	path?: string
}

/**
 * Structured metadata attached to a CleanupFinding.
 * Used by the UI to display richer context (age, ahead/behind, warnings).
 */
export interface CleanupFindingDetails {
	aheadCount?: number
	behindCount?: number
	lastCommitAgeDays?: number
	lastCommitAuthor?: string
	safetyWarnings?: string[]
	upstream?: string
}

export interface CleanupFinding {
	id: string
	category: CleanupCategory
	title: string
	reason: string
	risk: CleanupRisk
	fixable: boolean
	cleanupAction: CleanupAction
	details?: CleanupFindingDetails
}

/** Options passed to scan/findings methods. */
export interface ScanOptions {
	targetBranch: string
	ageDays: number
	include: CleanupCategory[]
	policy?: ResolvedCleanupPolicy
}
