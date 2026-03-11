export type CleanupCategory = "branch" | "stash" | "worktree"

export type CleanupRisk = "low" | "medium" | "high"

export type CleanupActionType =
	| "delete-branch"
	| "drop-stash"
	| "remove-worktree"

export interface CleanupAction {
	type: CleanupActionType
	target: string
	path?: string
}

export interface CleanupFinding {
	id: string
	category: CleanupCategory
	title: string
	reason: string
	risk: CleanupRisk
	fixable: boolean
	cleanupAction: CleanupAction
}

export interface ScanOptions {
	targetBranch: string
	ageDays: number
	include: CleanupCategory[]
}
