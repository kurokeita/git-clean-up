export type CleanupCategory = "branch" | "stash" | "worktree"

export type CleanupRisk = "low" | "medium" | "high"

export interface CleanupPolicy {
	protectedBranches?: string[]
	includeCategories?: CleanupCategory[]
	stashAgeDays?: number
	branchInactiveDays?: number
	divergedAheadCount?: number
	divergedBehindCount?: number
	branchExcludePatterns?: string[]
}

export interface ResolvedCleanupPolicy {
	protectedBranches: string[]
	includeCategories: CleanupCategory[]
	stashAgeDays: number
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

export interface ScanOptions {
	targetBranch: string
	ageDays: number
	include: CleanupCategory[]
	policy?: ResolvedCleanupPolicy
}
