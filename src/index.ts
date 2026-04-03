#!/usr/bin/env node
import { pathToFileURL } from "node:url"
import * as p from "@clack/prompts"
import color from "picocolors"
import type { CleanupFinding, CleanupRisk, ScanOptions } from "./cleanup.types"
import { CleanupExecutor } from "./cleanup-executor"
import { createCli } from "./cli"
import {
	getGlobalConfigPath,
	getLocalConfigPath,
	initializeCleanupPolicyConfig,
	loadCleanupPolicy,
	updateCleanupPolicyFile,
	waitForConfigChange,
} from "./config"
import { GitService } from "./git.service"
import * as ui from "./ui"
import { APP_NAME, checkForUpdates, installUpdate } from "./version"

/**
 * Collects all cleanup findings from enabled categories.
 * Runs branch, stash, and worktree detection in parallel where possible.
 */
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

/**
 * Checks if findings violate policy thresholds (maxFindings, failOn).
 * Used for CI mode to determine exit code.
 */
function checkPolicyViolation(
	findings: CleanupFinding[],
	options: ScanOptions,
): boolean {
	if (
		options.maxFindings !== undefined &&
		findings.length > options.maxFindings
	) {
		return true
	}

	if (options.failOn) {
		const riskLevels: CleanupRisk[] = ["low", "medium", "high"]
		const thresholdIndex = riskLevels.indexOf(options.failOn)

		for (const finding of findings) {
			const findingIndex = riskLevels.indexOf(finding.risk)
			if (findingIndex >= thresholdIndex) {
				return true
			}
		}
	}

	return false
}

async function runInteractiveScanLoop(
	gitService: GitService,
	cleanupExecutor: CleanupExecutor,
	options: ScanOptions,
	initialFindings?: CleanupFinding[],
): Promise<void> {
	let findings = initialFindings

	for (;;) {
		if (!findings) {
			const s = p.spinner()
			s.start("Scanning branches...")
			findings = await collectFindings(gitService, options)
			s.stop("Scan complete")
		}

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

		const selectedFindings = await ui.selectFindings(categoryFindings)
		if (selectedFindings.length === 0) {
			findings = undefined
			continue
		}

		// Check if any non-fixable findings were selected and warn
		const nonFixableSelected = selectedFindings.filter((f) => !f.fixable)
		if (nonFixableSelected.length > 0) {
			const warningMessage = [
				color.red(
					"⚠ Warning: You have selected branches that cannot be automatically cleaned:",
				),
				"",
				...nonFixableSelected.map(
					(f) => `  ${color.red("✖")} ${f.title} - ${f.reason}`,
				),
				"",
				"These branches have unpushed commits that would be permanently lost if deleted.",
				"You must manually handle these branches outside of this tool.",
			].join("\n")
			ui.showNote(warningMessage)
		}

		const selectedAction = await ui.selectFindingAction(selectedFindings.length)
		if (selectedAction === "back") {
			findings = undefined
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
			findings = undefined
			continue
		}

		const confirmed = await ui.confirmDeletion(selectedFindings.length)
		if (!confirmed) {
			findings = undefined
			continue
		}

		const s = p.spinner()
		s.start("Applying cleanup actions...")
		await cleanupExecutor.run(selectedFindings)
		s.stop("Cleanup actions applied")
		findings = undefined
	}
}

/**
 * Runs the CLI entrypoint: parse args, resolve policy, optionally guide config setup,
 * validate target branch selection, then execute scan or clean behavior.
 */
export async function runApp() {
	const cli = createCli()
	cli.program.parse()
	const parsedCommand = cli.getParsedCommand()

	if (!parsedCommand) {
		throw new Error("No command was parsed")
	}

	const isCi =
		process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true"

	if (!parsedCommand.options.json && !isCi) {
		const updateInfo = await checkForUpdates()

		if (updateInfo) {
			const shouldUpdate = await ui.promptForUpdate(updateInfo)

			if (shouldUpdate) {
				const updateSpinner = p.spinner()
				updateSpinner.start(`Updating ${APP_NAME}...`)

				try {
					await installUpdate()
					updateSpinner.stop(`${APP_NAME} updated`)
					ui.showDone(
						`Updated ${APP_NAME} to v${updateInfo.latestVersion}. Run ${APP_NAME} again to continue.`,
					)
					return
				} catch {
					updateSpinner.stop("Update failed")
					ui.showCancel(
						`Automatic update failed. Run pnpm install -g @kurokeita/git-clean-up@latest manually.`,
					)
				}
			}
		}

		await ui.showWelcome()
	}

	const gitService = new GitService()
	const cleanupExecutor = new CleanupExecutor()
	const s = p.spinner()
	const shouldPromptForConfigSetup =
		!parsedCommand.options.json && !isCi && parsedCommand.mode === "scan"

	try {
		if (!parsedCommand.options.json && !isCi) {
			s.start("Loading cleanup policy...")
		}
		const repositoryRoot = await gitService.getRepositoryRoot()
		let loadedPolicy = await loadCleanupPolicy(repositoryRoot)

		if (
			shouldPromptForConfigSetup &&
			!loadedPolicy.localConfigPath &&
			!loadedPolicy.globalConfigPath
		) {
			const globalConfigPath = getGlobalConfigPath()
			if (await ui.promptToCreateConfig("global", globalConfigPath)) {
				await initializeCleanupPolicyConfig(globalConfigPath)
				loadedPolicy = await loadCleanupPolicy(repositoryRoot)
			}
		}

		if (
			shouldPromptForConfigSetup &&
			!loadedPolicy.localConfigPath &&
			loadedPolicy.globalConfigPath
		) {
			const choice = await ui.promptForConfigScopeChoice(
				loadedPolicy.globalConfigPath,
				getLocalConfigPath(repositoryRoot),
			)

			if (choice === "exit") {
				ui.showCancel("Cleanup cancelled")
				return
			}

			if (choice === "local") {
				await initializeCleanupPolicyConfig(
					getLocalConfigPath(repositoryRoot),
					loadedPolicy.policy,
				)
				loadedPolicy = await loadCleanupPolicy(repositoryRoot)
			}
		}

		let targetBranch = parsedCommand.options.target
		const cliSkipPrune = parsedCommand.options.skipPrune
		const shouldPrune =
			!(cliSkipPrune ?? loadedPolicy.policy.skipPrune) && !targetBranch

		if (shouldPrune) {
			if (!parsedCommand.options.json && !isCi) {
				s.message("Pruning remotes...")
			}
			try {
				await gitService.pruneRemotes()
			} catch (_error) {
				// Ignore prune errors
			}
		}

		if (!parsedCommand.options.json && !isCi) {
			s.stop(shouldPrune ? "Remotes pruned" : "Cleanup policy loaded")
		}

		let policy = loadedPolicy.policy

		if (!targetBranch && policy.defaultTargetBranch) {
			let configuredTargetBranch = policy.defaultTargetBranch

			for (;;) {
				if (
					configuredTargetBranch !== "" &&
					(await gitService.branchRefExists(configuredTargetBranch))
				) {
					targetBranch = configuredTargetBranch
					break
				}

				const detectedTargetBranch = await gitService.getDefaultBranch()
				if (
					!shouldPromptForConfigSetup ||
					!loadedPolicy.defaultTargetBranchSourcePath
				) {
					if (configuredTargetBranch !== "") {
						throw new Error(
							`Configured defaultTargetBranch \`${configuredTargetBranch}\` from ${loadedPolicy.defaultTargetBranchSourcePath ?? "config"} does not exist.`,
						)
					}
					targetBranch = detectedTargetBranch
					break
				}

				const repairAction = await ui.promptToRepairDefaultTargetBranch({
					configPath: loadedPolicy.defaultTargetBranchSourcePath,
					configuredTargetBranch,
					detectedTargetBranch,
				})

				if (repairAction === "exit") {
					ui.showCancel("Cleanup cancelled")
					return
				}

				if (repairAction === "use-detected-default") {
					await updateCleanupPolicyFile(
						loadedPolicy.defaultTargetBranchSourcePath,
						{ defaultTargetBranch: detectedTargetBranch },
					)
					targetBranch = detectedTargetBranch
					break
				}

				ui.showNote(
					`Waiting for ${loadedPolicy.defaultTargetBranchSourcePath} to be updated...`,
				)
				await waitForConfigChange(loadedPolicy.defaultTargetBranchSourcePath)
				loadedPolicy = await loadCleanupPolicy(repositoryRoot)
				policy = loadedPolicy.policy
				configuredTargetBranch = loadedPolicy.policy.defaultTargetBranch ?? ""
			}
		}

		targetBranch ??= await gitService.getDefaultBranch()
		const scanOptions: ScanOptions = {
			ageDays: parsedCommand.options.ageDays ?? policy.stashAgeDays,
			failOn: parsedCommand.options.failOn as CleanupRisk,
			include: parsedCommand.options.include ?? policy.includeCategories,
			maxFindings: parsedCommand.options.maxFindings,
			policy,
			summary: parsedCommand.options.summary,
			targetBranch,
		}

		if (!parsedCommand.options.json && !isCi) {
			s.start("Scanning branches...")
		}
		const findings = await collectFindings(gitService, scanOptions)
		if (!parsedCommand.options.json && !isCi) {
			s.stop("Scan complete")
		}

		if (scanOptions.summary || parsedCommand.options.json || isCi) {
			if (scanOptions.summary) {
				ui.showSummary(findings)
			}
			if (parsedCommand.options.json) {
				console.log(ui.serializeFindings(findings))
			}

			if (checkPolicyViolation(findings, scanOptions)) {
				process.exit(1)
			}

			if (scanOptions.summary || parsedCommand.options.json) {
				return
			}
		}

		if (findings.length === 0) {
			ui.showDone("Your workspace is already clean! 🎉")
			return
		}

		if (parsedCommand.mode === "scan") {
			await runInteractiveScanLoop(
				gitService,
				cleanupExecutor,
				scanOptions,
				findings,
			)
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
		s.stop("Error during cleanup")
		if (error instanceof Error) {
			ui.showCancel(`Error: ${error.message}`)
		} else {
			ui.showCancel("An unknown error occurred")
		}
		process.exit(1)
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	runApp()
		.then(() => {
			process.exit(0)
		})
		.catch((err) => {
			console.error(err)
			process.exit(1)
		})
}
