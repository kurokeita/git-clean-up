import { existsSync } from "node:fs"
import { execa } from "execa"
import { isProtectedBranch, matchesBranchPatterns } from "./branch-protection"
import type {
	CleanupFinding,
	CleanupFindingDetails,
	ResolvedCleanupPolicy,
	ScanOptions,
} from "./cleanup.types"
import { DEFAULT_CLEANUP_POLICY } from "./config"

interface WorktreeInfo {
	path: string
	branch?: string
	detached: boolean
}

/** Metadata about a single branch used for finding enrichment. */
interface BranchInsight {
	aheadCount: number
	behindCount: number
	lastCommitAgeDays?: number
	lastCommitAuthor?: string
	upstream?: string
}

export class GitService {
	/**
	 * Returns the absolute path to the repository root.
	 */
	async getRepositoryRoot(): Promise<string> {
		const { stdout } = await execa("git", ["rev-parse", "--show-toplevel"])
		return stdout.trim()
	}

	/** Checks whether a git ref or branch name resolves successfully. */
	async branchRefExists(branch: string): Promise<boolean> {
		try {
			await execa("git", ["rev-parse", "--verify", "--quiet", branch])
			return true
		} catch (_error) {
			return false
		}
	}

	private async getBranchUpstream(branch: string): Promise<string | undefined> {
		const { stdout } = await execa("git", [
			"for-each-ref",
			"--format=%(upstream:short)",
			`refs/heads/${branch}`,
		])
		const upstream = stdout.trim()
		return upstream === "" ? undefined : upstream
	}

	private async getAheadBehindCounts(
		targetBranch: string,
		branch: string,
	): Promise<{ aheadCount: number; behindCount: number }> {
		try {
			const { stdout } = await execa("git", [
				"rev-list",
				"--left-right",
				"--count",
				`${targetBranch}...${branch}`,
			])
			const [behindRaw, aheadRaw] = stdout.trim().split("\t")

			return {
				aheadCount: Number(aheadRaw || 0),
				behindCount: Number(behindRaw || 0),
			}
		} catch (_error) {
			return {
				aheadCount: 0,
				behindCount: 0,
			}
		}
	}

	private async getLastCommitDetails(
		branch: string,
	): Promise<Pick<BranchInsight, "lastCommitAgeDays" | "lastCommitAuthor">> {
		try {
			const { stdout } = await execa("git", [
				"log",
				"-1",
				"--format=%ct|%an",
				branch,
			])
			const [timestampRaw, author = ""] = stdout.trim().split("|")
			const timestamp = Number(timestampRaw)

			if (!Number.isFinite(timestamp)) {
				return {}
			}

			const ageSeconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp)
			return {
				lastCommitAgeDays: Math.floor(ageSeconds / (24 * 60 * 60)),
				lastCommitAuthor: author.trim() === "" ? undefined : author.trim(),
			}
		} catch (_error) {
			return {}
		}
	}

	private async getBranchInsight(
		branch: string,
		targetBranch: string,
	): Promise<BranchInsight> {
		const [upstream, aheadBehind, lastCommitDetails] = await Promise.all([
			this.getBranchUpstream(branch),
			this.getAheadBehindCounts(targetBranch, branch),
			this.getLastCommitDetails(branch),
		])

		return {
			...aheadBehind,
			...lastCommitDetails,
			upstream,
		}
	}

	private toFindingDetails(
		insight?: BranchInsight,
		safetyWarnings: string[] = [],
	): CleanupFindingDetails | undefined {
		if (!insight && safetyWarnings.length === 0) {
			return undefined
		}

		const details: CleanupFindingDetails = {}

		if (insight) {
			details.aheadCount = insight.aheadCount
			details.behindCount = insight.behindCount
			details.lastCommitAgeDays = insight.lastCommitAgeDays
			details.lastCommitAuthor = insight.lastCommitAuthor
			details.upstream = insight.upstream
		}

		if (safetyWarnings.length > 0) {
			details.safetyWarnings = safetyWarnings
		}

		return details
	}

	/**
	 * Detects the repository's default branch.
	 */
	async getDefaultBranch(): Promise<string> {
		try {
			const { stdout } = await execa("git", [
				"symbolic-ref",
				"refs/remotes/origin/HEAD",
			])
			const remoteHead = stdout.trim().match(/^refs\/remotes\/(.+)$/)
			if (remoteHead?.[1]) {
				return remoteHead[1]
			}
		} catch (_error) {
			// Fall through to local branch detection.
		}

		for (const branch of ["main", "master"]) {
			if (await this.branchExists(branch)) {
				return branch
			}
		}

		const { stdout } = await execa("git", ["branch", "--show-current"])
		return stdout.trim()
	}

	/**
	 * Fetches and prunes remotes.
	 */
	async pruneRemotes(): Promise<void> {
		await execa("git", ["fetch", "--prune"])
	}

	/**
	 * Returns a list of local branches that have been merged into the target branch.
	 */
	async getMergedBranches(targetBranch: string): Promise<string[]> {
		const { stdout } = await execa("git", ["branch", "--merged", targetBranch])
		return stdout
			.split("\n")
			.map((branch) => branch.trim().replace(/^[*+]\s+/, ""))
			.filter((branch) => branch !== "")
	}

	/**
	 * Returns a list of local branches whose upstream/tracking branch is marked as 'gone'.
	 */
	async getGoneBranches(): Promise<string[]> {
		const { stdout } = await execa("git", [
			"for-each-ref",
			"--format=%(refname:short) %(upstream:track)",
			"refs/heads",
		])

		return stdout
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.includes("[gone]"))
			.map((line) => line.split(" ")[0])
	}

	/**
	 * Returns local branches that have no upstream tracking reference.
	 */
	async getNoUpstreamBranches(): Promise<string[]> {
		const { stdout } = await execa("git", [
			"for-each-ref",
			"--format=%(refname:short) %(upstream:short)",
			"refs/heads",
		])

		return stdout
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.filter((line) => !line.includes(" "))
	}

	/**
	 * Identifies branches that were merged into the target via a squash strategy.
	 * This uses the 'git cherry' method with a temporary commit.
	 */
	async identifySquashedBranches(
		targetBranch: string,
		candidates: string[],
	): Promise<string[]> {
		const squashed: string[] = []

		for (const branch of candidates) {
			try {
				const { stdout: mergeBase } = await execa("git", [
					"merge-base",
					targetBranch,
					branch,
				])
				const { stdout: treeId } = await execa("git", [
					"rev-parse",
					`${branch}^{tree}`,
				])

				const { stdout: tmpCommit } = await execa("git", [
					"commit-tree",
					treeId.trim(),
					"-p",
					mergeBase.trim(),
					"-m",
					`squash-check-${branch}`,
				])

				const { stdout: cherryOutput } = await execa("git", [
					"cherry",
					targetBranch,
					tmpCommit.trim(),
				])

				if (cherryOutput.trim().startsWith("-")) {
					squashed.push(branch)
				}
			} catch (_error) {
				// Skip if any command fails for a specific branch
			}
		}

		return squashed
	}

	/**
	 * Identifies branches significantly diverged from the target.
	 * Uses ahead/behind thresholds from the resolved policy.
	 */
	async getLongDivergedBranches(
		targetBranch: string,
		policy: ResolvedCleanupPolicy,
	): Promise<string[]> {
		const branches = await this.getTrackedBranchNames()
		const diverged: string[] = []

		for (const branch of branches) {
			if (
				branch === targetBranch ||
				isProtectedBranch(branch, policy.protectedBranches) ||
				matchesBranchPatterns(branch, policy.branchExcludePatterns)
			) {
				continue
			}

			try {
				const { aheadCount, behindCount } = await this.getAheadBehindCounts(
					targetBranch,
					branch,
				)
				if (
					aheadCount >= policy.divergedAheadCount &&
					behindCount >= policy.divergedBehindCount
				) {
					diverged.push(branch)
				}
			} catch (_error) {
				// Skip branches that cannot be compared to the target.
			}
		}

		return diverged
	}

	/**
	 * Returns all local branches except the current one and those used by worktrees.
	 */
	async getAllLocalBranches(): Promise<string[]> {
		const [{ stdout: branchOutput }, { stdout: worktreeOutput }] =
			await Promise.all([
				execa("git", [
					"for-each-ref",
					"--format=%(refname:short)",
					"refs/heads",
				]),
				execa("git", ["worktree", "list", "--porcelain"]),
			])

		const usedInWorktrees = new Set<string>()
		const lines = worktreeOutput.split("\n")
		for (const line of lines) {
			if (line.startsWith("branch ")) {
				const branchRef = line.substring(7).trim() // e.g. refs/heads/main
				const branchName = branchRef.replace(/^refs\/heads\//, "")
				usedInWorktrees.add(branchName)
			}
		}

		const branches: string[] = []
		const branchLines = branchOutput.split("\n").map((line) => line.trim())
		for (const line of branchLines) {
			if (line === "") continue
			const [name] = line.split(" ")
			if (!usedInWorktrees.has(name)) {
				branches.push(name)
			}
		}
		return branches
	}

	async getStashFindings(ageDays: number): Promise<CleanupFinding[]> {
		const { stdout } = await execa("git", [
			"stash",
			"list",
			"--format=%gd|%ct|%gs",
		])

		const findings: CleanupFinding[] = []
		const cutoff = Math.floor(Date.now() / 1000) - ageDays * 24 * 60 * 60
		const messages = new Map<string, string[]>()

		for (const line of stdout.split("\n").map((entry) => entry.trim())) {
			if (line === "") {
				continue
			}

			const [reference, timestampRaw, ...messageParts] = line.split("|")
			const message = messageParts.join("|")
			const timestamp = Number(timestampRaw)
			const title = message === "" ? reference : `${reference}: ${message}`

			if (!messages.has(message)) {
				messages.set(message, [])
			}
			messages.get(message)?.push(reference)

			if (timestamp <= cutoff) {
				findings.push({
					category: "stash",
					cleanupAction: {
						target: reference,
						type: "drop-stash",
					},
					fixable: true,
					id: `stash:${reference}:old`,
					reason: `Older than ${ageDays} days`,
					risk: "medium",
					title,
				})
			}

			if (message.startsWith("WIP on") && timestamp <= cutoff) {
				findings.push({
					category: "stash",
					cleanupAction: {
						target: reference,
						type: "drop-stash",
					},
					fixable: true,
					id: `stash:${reference}:stale-wip`,
					reason: `Stale WIP stash older than ${ageDays} days`,
					risk: "medium",
					title,
				})
			}
		}

		for (const [message, references] of messages.entries()) {
			if (references.length < 2) {
				continue
			}
			for (const reference of references) {
				findings.push({
					category: "stash",
					cleanupAction: {
						target: reference,
						type: "drop-stash",
					},
					fixable: true,
					id: `stash:${reference}:duplicate-message`,
					reason: `Duplicate stash message: ${message}`,
					risk: "low",
					title: message === "" ? reference : `${reference}: ${message}`,
				})
			}
		}

		return findings
	}

	/**
	 * Collects all branch cleanup findings by running detection heuristics in parallel.
	 * Enriches findings with branch metadata (age, ahead/behind counts, upstream).
	 * Respects policy for protected branches, exclusions, and thresholds.
	 */
	async getBranchFindings(options: ScanOptions): Promise<CleanupFinding[]> {
		const policy = options.policy ?? DEFAULT_CLEANUP_POLICY
		const [merged, gone, noUpstream, allLocal, worktreeBranches, diverged] =
			await Promise.all([
				this.getMergedBranches(options.targetBranch),
				this.getGoneBranches(),
				this.getNoUpstreamBranches(),
				this.getAllLocalBranches(),
				this.getUsedWorktreeBranches(),
				this.getLongDivergedBranches(options.targetBranch, policy),
			])

		const candidates = new Set([
			...allLocal,
			...merged,
			...gone,
			...noUpstream,
			...diverged,
		])
		const findings = new Map<string, CleanupFinding>()
		const noUpstreamSet = new Set(noUpstream)
		const goneSet = new Set(gone)
		const mergedSet = new Set(merged)
		const branchInsights = new Map<string, BranchInsight>()
		const candidateBranches = allLocal.filter(
			(branch) =>
				!isProtectedBranch(branch, policy.protectedBranches) &&
				!matchesBranchPatterns(branch, policy.branchExcludePatterns) &&
				!worktreeBranches.has(branch),
		)

		await Promise.all(
			candidateBranches.map(async (branch) => {
				branchInsights.set(
					branch,
					await this.getBranchInsight(branch, options.targetBranch),
				)
			}),
		)

		const addFinding = (
			branch: string,
			suffix: string,
			reason: string,
			overrides?: Partial<CleanupFinding>,
		) => {
			if (
				isProtectedBranch(branch, policy.protectedBranches) ||
				matchesBranchPatterns(branch, policy.branchExcludePatterns) ||
				!candidates.has(branch) ||
				worktreeBranches.has(branch)
			) {
				return
			}

			const insight = branchInsights.get(branch)
			const safetyWarnings =
				insight && insight.aheadCount > 0
					? [
							`${insight.aheadCount} commit${insight.aheadCount === 1 ? "" : "s"} unique to this branch`,
						]
					: []

			findings.set(`branch:${branch}:${suffix}`, {
				category: "branch",
				cleanupAction: {
					target: branch,
					type: "delete-branch",
				},
				fixable: true,
				id: `branch:${branch}:${suffix}`,
				reason,
				risk: suffix === "gone" ? "low" : "medium",
				title: branch,
				details: this.toFindingDetails(insight, safetyWarnings),
				...overrides,
			})
		}

		for (const branch of merged) {
			if (noUpstreamSet.has(branch)) {
				continue
			}
			addFinding(branch, "merged", `Merged into ${options.targetBranch}`)
		}
		for (const branch of gone) {
			addFinding(branch, "gone", "Remote tracking branch is gone")
		}
		for (const branch of noUpstream) {
			addFinding(branch, "no-upstream", "Local branch has no upstream")
		}
		for (const branch of diverged) {
			addFinding(branch, "long-diverged", "Branch has significantly diverged")
		}

		for (const branch of candidateBranches) {
			const insight = branchInsights.get(branch)
			if (!insight) {
				continue
			}

			const alreadyFlagged = [...findings.values()].some(
				(finding) => finding.title === branch,
			)

			const isInactive =
				!alreadyFlagged &&
				!mergedSet.has(branch) &&
				!goneSet.has(branch) &&
				(insight.lastCommitAgeDays ?? 0) >= policy.branchInactiveDays &&
				(noUpstreamSet.has(branch) ||
					insight.behindCount >= policy.divergedBehindCount)

			if (!isInactive) {
				continue
			}

			const hasUniqueCommits = insight.aheadCount > 0
			const safetyWarnings = hasUniqueCommits
				? [
						`${insight.aheadCount} commit${insight.aheadCount === 1 ? "" : "s"} unique to this branch`,
					]
				: []

			addFinding(
				branch,
				"inactive",
				`Inactive for ${insight.lastCommitAgeDays} days and behind ${options.targetBranch}`,
				{
					details: this.toFindingDetails(insight, safetyWarnings),
					fixable: !hasUniqueCommits,
					risk: hasUniqueCommits ? "high" : "medium",
				},
			)
		}

		const potentialSquashed = allLocal.filter(
			(branch) =>
				![...findings.values()].some((finding) => finding.title === branch),
		)
		const squashed = await this.identifySquashedBranches(
			options.targetBranch,
			potentialSquashed,
		)
		for (const branch of squashed) {
			addFinding(
				branch,
				"squashed",
				`Squash-merged into ${options.targetBranch}`,
			)
		}

		return [...findings.values()]
	}

	/**
	 * Collects all worktree cleanup findings (missing paths, detached heads, stale branches).
	 * Respects policy for protected branch exclusions.
	 */
	async getWorktreeFindings(options: ScanOptions): Promise<CleanupFinding[]> {
		const policy = options.policy ?? DEFAULT_CLEANUP_POLICY
		const [worktrees, staleBranches, currentWorktreePath] = await Promise.all([
			this.getWorktrees(),
			this.getWorktreeStaleBranches(options),
			this.getRepositoryRoot(),
		])

		const findings = new Map<string, CleanupFinding>()

		for (const worktree of worktrees) {
			if (worktree.path === currentWorktreePath) {
				continue
			}

			if (!this.pathLooksAvailable(worktree.path)) {
				findings.set(`worktree:${worktree.path}:missing-path`, {
					category: "worktree",
					cleanupAction: {
						target: worktree.path,
						type: "remove-worktree",
					},
					fixable: true,
					id: `worktree:${worktree.path}:missing-path`,
					reason: "Worktree path is missing or inaccessible",
					risk: "high",
					title: worktree.path,
				})
			}

			if (worktree.detached) {
				findings.set(`worktree:${worktree.path}:detached-head`, {
					category: "worktree",
					cleanupAction: {
						target: worktree.path,
						type: "remove-worktree",
					},
					fixable: true,
					id: `worktree:${worktree.path}:detached-head`,
					reason: "Worktree is on a detached HEAD",
					risk: "high",
					title: worktree.path,
				})
			}

			if (
				worktree.branch &&
				isProtectedBranch(worktree.branch, policy.protectedBranches)
			) {
				findings.set(`worktree:${worktree.path}:protected-branch`, {
					category: "worktree",
					cleanupAction: {
						target: worktree.path,
						type: "remove-worktree",
					},
					fixable: false,
					id: `worktree:${worktree.path}:protected-branch`,
					reason: `Worktree is attached to protected branch ${worktree.branch}`,
					risk: "high",
					title: worktree.path,
				})
			}

			if (worktree.branch && staleBranches.has(worktree.branch)) {
				findings.set(`worktree:${worktree.path}:stale-branch`, {
					category: "worktree",
					cleanupAction: {
						target: worktree.path,
						type: "remove-worktree",
					},
					fixable: true,
					id: `worktree:${worktree.path}:stale-branch`,
					reason: `Worktree points to stale branch ${worktree.branch}`,
					risk: "medium",
					title: worktree.path,
				})
			}
		}

		return [...findings.values()]
	}

	private async getTrackedBranchNames(): Promise<string[]> {
		const { stdout } = await execa("git", [
			"for-each-ref",
			"--format=%(refname:short) %(upstream:short)",
			"refs/heads",
		])

		return stdout
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.includes(" "))
			.filter((line) => line.split(" ")[1] !== "[gone]")
			.map((line) => line.split(" ")[0])
	}

	private async branchExists(branch: string): Promise<boolean> {
		try {
			await execa("git", [
				"show-ref",
				"--verify",
				"--quiet",
				`refs/heads/${branch}`,
			])
			return true
		} catch (_error) {
			return false
		}
	}

	private async getUsedWorktreeBranches(): Promise<Set<string>> {
		const { stdout } = await execa("git", ["worktree", "list", "--porcelain"])
		const branches = new Set<string>()

		for (const line of stdout.split("\n")) {
			if (!line.startsWith("branch ")) {
				continue
			}
			branches.add(
				line
					.substring(7)
					.trim()
					.replace(/^refs\/heads\//, ""),
			)
		}

		return branches
	}

	private async getWorktrees(): Promise<WorktreeInfo[]> {
		const { stdout } = await execa("git", ["worktree", "list", "--porcelain"])
		const worktrees: WorktreeInfo[] = []
		let current: WorktreeInfo | undefined

		for (const line of stdout.split("\n")) {
			if (line.startsWith("worktree ")) {
				if (current) {
					worktrees.push(current)
				}
				current = {
					detached: false,
					path: line.substring(9).trim(),
				}
				continue
			}

			if (!current) {
				continue
			}

			if (line.startsWith("branch ")) {
				current.branch = line
					.substring(7)
					.trim()
					.replace(/^refs\/heads\//, "")
			}

			if (line.trim() === "detached") {
				current.detached = true
			}
		}

		if (current) {
			worktrees.push(current)
		}

		return worktrees
	}

	private async getWorktreeStaleBranches(
		options: ScanOptions,
	): Promise<Set<string>> {
		const policy = options.policy ?? DEFAULT_CLEANUP_POLICY
		const [merged, gone] = await Promise.all([
			this.getMergedBranches(options.targetBranch),
			this.getGoneBranches(),
		])

		return new Set(
			[...merged, ...gone].filter(
				(branch) =>
					!isProtectedBranch(branch, policy.protectedBranches) &&
					!matchesBranchPatterns(branch, policy.branchExcludePatterns),
			),
		)
	}

	private pathLooksAvailable(path: string): boolean {
		return existsSync(path)
	}
}
