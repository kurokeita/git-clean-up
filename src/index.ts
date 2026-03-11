#!/usr/bin/env node
import type { CleanupFinding, ScanOptions } from "./cleanup.types"
import { CleanupExecutor } from "./cleanup-executor"
import { createCli } from "./cli"
import { GitService } from "./git.service"
import * as ui from "./ui"

async function collectFindings(
	gitService: GitService,
	options: ScanOptions,
): Promise<CleanupFinding[]> {
	const findings: CleanupFinding[] = []

	if (options.include.includes("branch")) {
		findings.push(...(await gitService.getBranchFindings(options)))
	}
	if (options.include.includes("stash")) {
		findings.push(...(await gitService.getStashFindings(options.ageDays)))
	}
	if (options.include.includes("worktree")) {
		findings.push(...(await gitService.getWorktreeFindings(options)))
	}

	return findings
}

async function runInteractiveScanLoop(
	gitService: GitService,
	cleanupExecutor: CleanupExecutor,
	options: ScanOptions,
): Promise<void> {
	for (;;) {
		const findings = await collectFindings(gitService, options)
		if (findings.length === 0) {
			ui.showDone("Your workspace is already clean! 🎉")
			return
		}

		const selectedCategory = await ui.selectFindingCategory(findings)
		if (!selectedCategory) {
			ui.showDone(`Scan found ${findings.length} cleanup opportunities.`)
			return
		}

		const categoryFindings = findings.filter(
			(finding) => finding.category === selectedCategory,
		)
		ui.showNote(categoryFindings.map(ui.formatFindingLabel).join("\n"))

		const selectedFindings = await ui.selectFindings(
			categoryFindings.filter((finding) => finding.fixable),
		)
		if (selectedFindings.length === 0) {
			continue
		}

		const selectedAction = await ui.selectFindingAction(selectedFindings.length)
		if (selectedAction === "back") {
			continue
		}
		if (selectedAction === "exit") {
			ui.showDone(`Scan found ${findings.length} cleanup opportunities.`)
			return
		}
		if (selectedAction === "preview") {
			const commands = cleanupExecutor.previewCommands(selectedFindings)
			ui.showNote(
				[
					`Dry run: would apply ${selectedFindings.length} cleanup actions.`,
					...commands,
				].join("\n"),
			)
			continue
		}

		const confirmed = await ui.confirmDeletion(selectedFindings.length)
		if (!confirmed) {
			continue
		}

		const spinner = ui.createSpinner()
		spinner.start("Applying cleanup actions...")
		await cleanupExecutor.run(selectedFindings)
		spinner.stop("Cleanup actions applied")
	}
}

async function main() {
	const cli = createCli()
	cli.program.parse()
	const parsedCommand = cli.getParsedCommand()

	if (!parsedCommand) {
		throw new Error("No command was parsed")
	}

	if (!parsedCommand.options.json) {
		await ui.showWelcome()
	}

	const gitService = new GitService()
	const cleanupExecutor = new CleanupExecutor()
	const s = parsedCommand.options.json
		? {
				message(_message: string) {},
				start(_message: string) {},
				stop(_message: string, _code?: number) {},
			}
		: ui.createSpinner()

	s.start("Pruning remotes...")
	try {
		await gitService.pruneRemotes()
		s.stop("Remotes pruned")
	} catch (_error) {
		s.stop("Failed to prune remotes", 1)
	}

	s.start("Scanning branches...")

	try {
		const scanOptions: ScanOptions = {
			ageDays: parsedCommand.options.ageDays,
			include: parsedCommand.options.include,
			targetBranch: parsedCommand.options.target,
		}
		const findings = await collectFindings(gitService, scanOptions)
		s.stop("Scan complete")

		if (findings.length === 0) {
			ui.showDone("Your workspace is already clean! 🎉")
			return
		}

		if (parsedCommand.options.json) {
			console.log(ui.serializeFindings(findings))
			return
		}

		if (parsedCommand.mode === "scan") {
			await runInteractiveScanLoop(gitService, cleanupExecutor, scanOptions)
			return
		}

		const selectedFindings = parsedCommand.options.all
			? findings.filter((finding) => finding.fixable)
			: await ui.selectFindings(findings.filter((finding) => finding.fixable))

		if (selectedFindings.length === 0) {
			ui.showCancel("Cleanup cancelled")
			return
		}

		if (!parsedCommand.options.apply) {
			const commands = cleanupExecutor.previewCommands(selectedFindings)
			ui.showDone(
				[
					`Dry run: would apply ${selectedFindings.length} cleanup actions.`,
					...commands,
				].join("\n"),
			)
			return
		}

		const confirmed =
			parsedCommand.options.all ||
			(await ui.confirmDeletion(selectedFindings.length))
		if (!confirmed) {
			ui.showCancel("Cleanup cancelled")
			return
		}

		s.start("Applying cleanup actions...")
		await cleanupExecutor.run(selectedFindings)
		s.stop("Cleanup actions applied")

		ui.showDone(
			`Successfully applied ${selectedFindings.length} cleanup actions!`,
		)
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
