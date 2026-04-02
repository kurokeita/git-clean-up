import { execa } from "execa"
import type { CleanupFindingDetails } from "./cleanup.types"

export interface WorktreeSafetyInsight {
	isDirty: boolean
	hasUntracked: boolean
	unpushedCount: number
	isDetachedUnreachable: boolean
	safetyWarnings: string[]
	details: CleanupFindingDetails
}

/**
 * Inspects a worktree directory for uncommitted changes, untracked files,
 * and unpushed commits to determine if it is safe to remove.
 */
export async function inspectWorktree(
	path: string,
	branch?: string,
	isDetached = false,
): Promise<WorktreeSafetyInsight> {
	const [isDirty, hasUntracked, unpushedCount, isDetachedUnreachable] =
		await Promise.all([
			checkIfDirty(path),
			checkIfHasUntracked(path),
			checkUnpushedCommits(path, branch),
			checkDetachedHeadSafety(path, isDetached),
		])

	const safetyWarnings: string[] = []
	if (isDirty) {
		safetyWarnings.push("Has uncommitted changes")
	}
	if (hasUntracked) {
		safetyWarnings.push("Has untracked files")
	}
	if (unpushedCount > 0) {
		safetyWarnings.push(
			`${unpushedCount} unpushed commit${unpushedCount === 1 ? "" : "s"}`,
		)
	}
	if (isDetachedUnreachable) {
		safetyWarnings.push(
			"Detached HEAD commits are not reachable from any branch",
		)
	}

	return {
		details: {
			safetyWarnings: safetyWarnings.length > 0 ? safetyWarnings : undefined,
		},
		hasUntracked,
		isDetachedUnreachable,
		isDirty,
		safetyWarnings,
		unpushedCount,
	}
}

async function checkDetachedHeadSafety(
	path: string,
	isDetached: boolean,
): Promise<boolean> {
	if (!isDetached) {
		return false
	}

	try {
		// git branch --contains HEAD lists branches that contain the current HEAD commit.
		// If only (HEAD detached at ...) is listed, it's not reachable from any branch.
		const { stdout } = await execa("git", ["branch", "--contains", "HEAD"], {
			cwd: path,
		})

		const branches = stdout
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line !== "" && !line.startsWith("* (HEAD detached"))

		return branches.length === 0
	} catch (_error) {
		// If command fails, we assume it's risky.
		return true
	}
}

async function checkIfDirty(path: string): Promise<boolean> {
	try {
		const { stdout } = await execa("git", ["status", "--porcelain"], {
			cwd: path,
		})
		// Filter out untracked files (??) to only detect modified/staged files
		const lines = stdout.split("\n").filter((line) => {
			const status = line.slice(0, 2)
			return status !== "??" && status.trim() !== ""
		})
		return lines.length > 0
	} catch (_error) {
		return false
	}
}

async function checkIfHasUntracked(path: string): Promise<boolean> {
	try {
		const { stdout } = await execa("git", ["status", "--porcelain"], {
			cwd: path,
		})
		return stdout.split("\n").some((line) => line.startsWith("??"))
	} catch (_error) {
		return false
	}
}

async function checkUnpushedCommits(
	path: string,
	branch?: string,
): Promise<number> {
	if (!branch) {
		return 0
	}

	try {
		// Get the upstream for this branch within the worktree
		const { stdout: upstream } = await execa(
			"git",
			["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
			{ cwd: path },
		)

		if (!upstream.trim()) {
			return 0
		}

		const { stdout: count } = await execa(
			"git",
			["rev-list", "--count", `${upstream.trim()}..HEAD`],
			{ cwd: path },
		)

		return Number.parseInt(count.trim(), 10) || 0
	} catch (_error) {
		// If no upstream is configured, we could treat all commits as unpushed,
		// but for now we follow the existing pattern of "no upstream" being its own category.
		return 0
	}
}
