import { execa } from "execa"

export class GitService {
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
			.map((b) => b.trim())
			.filter((b) => b !== "" && !b.startsWith("*"))
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
	 * Returns all local branches except the current one and those used by worktrees.
	 */
	async getAllLocalBranches(): Promise<string[]> {
		const [{ stdout: branchOutput }, { stdout: worktreeOutput }] =
			await Promise.all([
				execa("git", ["branch", "--format=%(refname:short) %(HEAD)"]),
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
			const [name, head] = line.split(" ")
			if (head !== "*" && !usedInWorktrees.has(name)) {
				branches.push(name)
			}
		}
		return branches
	}
}
