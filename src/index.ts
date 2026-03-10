#!/usr/bin/env node
import { execa } from "execa"
import { isProtectedBranch } from "./branch-protection"
import { createProgram } from "./cli"
import { GitService } from "./git.service"
import * as ui from "./ui"

async function main() {
	const program = createProgram()
	program.parse()
	const options = program.opts()

	await ui.showWelcome()

	const gitService = new GitService()
	const s = ui.createSpinner()

	s.start("Pruning remotes...")
	try {
		await gitService.pruneRemotes()
		s.stop("Remotes pruned")
	} catch (_error) {
		s.stop("Failed to prune remotes", 1)
	}

	s.start("Scanning branches...")

	try {
		const [merged, gone, allLocal] = await Promise.all([
			gitService.getMergedBranches(options.target),
			gitService.getGoneBranches(),
			gitService.getAllLocalBranches(),
		])

		const deletableBranches = new Set(allLocal)
		const allCandidates = new Map<string, string[]>()

		const addCandidate = (name: string, reason: string) => {
			if (isProtectedBranch(name) || !deletableBranches.has(name)) return
			const existing = allCandidates.get(name) || []
			if (!existing.includes(reason)) {
				allCandidates.set(name, [...existing, reason])
			}
		}
		for (const b of merged) addCandidate(b, "merged")
		for (const b of gone) addCandidate(b, "gone")

		const potentialSquashed = allLocal.filter((b) => !allCandidates.has(b))
		if (potentialSquashed.length > 0) {
			s.message("Checking for squashed merges...")
			const squashed = await gitService.identifySquashedBranches(
				options.target,
				potentialSquashed,
			)
			for (const b of squashed) addCandidate(b, "squashed")
		}

		s.stop("Scan complete")

		const branchesToSelect = Array.from(allCandidates.entries()).map(
			([name, reasons]) => ({
				name,
				reason: reasons.join(", "),
			}),
		)

		if (branchesToSelect.length === 0) {
			ui.showDone("Your workspace is already clean! 🎉")
			return
		}

		const selectedBranches = options.all
			? branchesToSelect.map((b) => b.name)
			: await ui.selectBranches(branchesToSelect)

		if (selectedBranches.length === 0) {
			ui.showCancel("Cleanup cancelled")
			return
		}

		if (options.dryRun) {
			ui.showDone(
				`Dry run: would have deleted ${selectedBranches.length} branches: ${selectedBranches.join(", ")}`,
			)
			return
		}

		const confirmed =
			options.all || (await ui.confirmDeletion(selectedBranches.length))
		if (!confirmed) {
			ui.showCancel("Cleanup cancelled")
			return
		}
		s.start("Deleting branches...")
		for (const branch of selectedBranches) {
			await execa("git", ["branch", "-D", branch])
		}
		s.stop("Branches deleted")

		ui.showDone(`Successfully cleaned up ${selectedBranches.length} branches!`)
	} catch (error) {
		s.stop("Error during cleanup", 1)
		if (error instanceof Error) {
			ui.showCancel(`Error: ${error.message}`)
		} else {
			ui.showCancel("An unknown error occurred")
		}
		process.exit(1)
	}
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})
