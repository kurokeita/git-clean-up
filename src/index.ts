#!/usr/bin/env node
import { pathToFileURL } from "node:url"
import type { CleanupFinding, ScanOptions } from "./cleanup.types"
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

	if (!parsedCommand.options.json) {
		const updateInfo = await checkForUpdates()

		if (updateInfo) {
			const shouldUpdate = await ui.promptForUpdate(updateInfo)

			if (shouldUpdate) {
				const updateSpinner = ui.createSpinner()
				updateSpinner.start(`Updating ${APP_NAME}...`)

				try {
					await installUpdate()
					updateSpinner.stop(`${APP_NAME} updated`)
					ui.showDone(
						`Updated ${APP_NAME} to v${updateInfo.latestVersion}. Run ${APP_NAME} again to continue.`,
					)
					return
				} catch {
					updateSpinner.stop("Update failed", 1)
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
	const s = parsedCommand.options.json
		? {
				message(_message: string) {},
				start(_message: string) {},
				stop(_message: string, _code?: number) {},
			}
		: ui.createSpinner()
	const shouldPromptForConfigSetup =
		!parsedCommand.options.json && parsedCommand.mode === "scan"

	try {
		s.start("Loading cleanup policy...")
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
				await initializeCleanupPolicyConfig(getLocalConfigPath(repositoryRoot))
				loadedPolicy = await loadCleanupPolicy(repositoryRoot)
			}
		}

		s.stop("Cleanup policy loaded")

		s.start("Pruning remotes...")
		try {
			await gitService.pruneRemotes()
			s.stop("Remotes pruned")
		} catch (_error) {
			s.stop("Failed to prune remotes", 1)
		}

		s.start("Scanning branches...")

		let targetBranch = parsedCommand.options.target
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
			include: parsedCommand.options.include ?? policy.includeCategories,
			policy,
			targetBranch,
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

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	runApp().catch((err) => {
		console.error(err)
		process.exit(1)
	})
}
