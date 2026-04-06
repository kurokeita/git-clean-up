import { beforeEach, describe, expect, it, vi } from "vitest"

const uiMock = vi.hoisted(() => ({
	confirmDeletion: vi.fn(),
	createSpinner: vi.fn(() => ({
		message: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
		cancel: vi.fn(),
		error: vi.fn(),
		clear: vi.fn(),
		isCancelled: false,
	})),
	formatConfigScopeNote: vi.fn(
		({ scope, configPath, configPolicy, localConfigPath }) =>
			[
				`Using ${scope} config from ${configPath}.`,
				"",
				`Current ${scope} config:`,
				...Object.entries(configPolicy).map(([key, value]) => {
					const formattedValue = Array.isArray(value)
						? value.join(", ")
						: typeof value === "string"
							? value
							: String(value)
					return `- ${key}: ${formattedValue}`
				}),
				...(localConfigPath
					? ["", "Create local config at:", localConfigPath]
					: []),
			].join("\n"),
	),
	formatFindingLabel: vi.fn((finding) => finding.title),
	promptForConfigScopeChoice: vi.fn(),
	promptForForceDelete: vi.fn().mockResolvedValue(false),
	promptToCreateConfig: vi.fn(),
	promptToRepairDefaultTargetBranch: vi.fn(),
	promptForUpdate: vi.fn(),
	selectFindingAction: vi.fn(),
	selectFindingCategory: vi.fn(),
	selectFindings: vi.fn(),
	showCancel: vi.fn(),
	showDone: vi.fn(),
	showNote: vi.fn(),
	showWelcome: vi.fn(),
}))

const versionMock = vi.hoisted(() => ({
	checkForUpdates: vi.fn(),
	installUpdate: vi.fn(),
}))

const cliMock = vi.hoisted(() => ({
	getParsedCommand: vi.fn(),
	program: {
		parse: vi.fn(),
	},
}))

const gitServiceMock = vi.hoisted(() => ({
	branchRefExists: vi.fn(),
	getDefaultBranch: vi.fn(),
	getBranchFindings: vi.fn(),
	getRepositoryRoot: vi.fn(),
	getStashFindings: vi.fn(),
	getWorktreeFindings: vi.fn(),
	pruneRemotes: vi.fn(),
}))

const cleanupExecutorMock = vi.hoisted(() => ({
	previewCommands: vi.fn(),
	run: vi.fn(),
}))

const configMock = vi.hoisted(() => ({
	getGlobalConfigPath: vi.fn(),
	getLocalConfigPath: vi.fn(),
	initializeCleanupPolicyConfig: vi.fn(),
	loadCleanupPolicy: vi.fn(),
	updateCleanupPolicyFile: vi.fn(),
	waitForConfigChange: vi.fn(),
}))

vi.mock("../ui", () => uiMock)
vi.mock("../version", async () => {
	const actual =
		await vi.importActual<typeof import("../version")>("../version")
	return {
		...actual,
		checkForUpdates: versionMock.checkForUpdates,
		installUpdate: versionMock.installUpdate,
	}
})
vi.mock("../cli", () => ({
	createCli: () => cliMock,
}))
vi.mock("../config", () => configMock)
vi.mock("../git.service", () => ({
	GitService: vi.fn(function GitServiceMock() {
		return gitServiceMock
	}),
}))
vi.mock("../cleanup-executor", () => ({
	CleanupExecutor: vi.fn(function CleanupExecutorMock() {
		return cleanupExecutorMock
	}),
}))

describe("runApp", () => {
	beforeEach(() => {
		vi.resetModules()
		vi.stubEnv("CI", "")
		vi.stubEnv("GITHUB_ACTIONS", "")
		cliMock.program.parse.mockReset()
		cliMock.getParsedCommand.mockReset()
		uiMock.showWelcome.mockReset()
		uiMock.showDone.mockReset()
		uiMock.showCancel.mockReset()
		uiMock.showNote.mockReset()
		uiMock.promptForUpdate.mockReset()
		uiMock.promptForConfigScopeChoice.mockReset()
		uiMock.promptForForceDelete.mockReset()
		uiMock.promptForForceDelete.mockResolvedValue(false)
		uiMock.promptToCreateConfig.mockReset()
		uiMock.promptToRepairDefaultTargetBranch.mockReset()
		uiMock.createSpinner.mockClear()
		versionMock.checkForUpdates.mockReset()
		versionMock.installUpdate.mockReset()
		configMock.getGlobalConfigPath.mockReset()
		configMock.getLocalConfigPath.mockReset()
		configMock.initializeCleanupPolicyConfig.mockReset()
		configMock.loadCleanupPolicy.mockReset()
		configMock.updateCleanupPolicyFile.mockReset()
		configMock.waitForConfigChange.mockReset()
		gitServiceMock.pruneRemotes.mockReset()
		gitServiceMock.branchRefExists?.mockReset?.()
		gitServiceMock.getRepositoryRoot.mockReset()
		gitServiceMock.getDefaultBranch.mockReset()
		gitServiceMock.getBranchFindings.mockReset()
		gitServiceMock.getStashFindings.mockReset()
		gitServiceMock.getWorktreeFindings.mockReset()
		cleanupExecutorMock.previewCommands.mockReset()
		cleanupExecutorMock.run.mockReset()

		cliMock.getParsedCommand.mockReturnValue({
			mode: "scan",
			options: {
				ageDays: 30,
				all: false,
				apply: false,
				include: ["branch"],
				json: false,
				target: undefined,
			},
		})
		versionMock.checkForUpdates.mockResolvedValue(null)
		uiMock.promptForConfigScopeChoice.mockResolvedValue("global")
		uiMock.promptToCreateConfig.mockResolvedValue(false)
		uiMock.promptToRepairDefaultTargetBranch.mockResolvedValue("exit")
		configMock.getGlobalConfigPath.mockReturnValue(
			"/home/test/.git-clean-up.json",
		)
		configMock.getLocalConfigPath.mockReturnValue(
			`${process.cwd()}/.git-clean-up.json`,
		)
		configMock.loadCleanupPolicy.mockResolvedValue({
			policy: {
				branchExcludePatterns: [],
				branchInactiveDays: 90,
				defaultTargetBranch: undefined,
				divergedAheadCount: 10,
				divergedBehindCount: 10,
				includeCategories: ["branch", "stash", "worktree"],
				protectedBranches: ["main", "master", "develop", "dev"],
				stashAgeDays: 30,
				skipPrune: false,
			},
		})
		gitServiceMock.branchRefExists = vi.fn().mockResolvedValue(true)
		gitServiceMock.getDefaultBranch.mockResolvedValue("origin/main")
		gitServiceMock.getBranchFindings.mockResolvedValue([])
		gitServiceMock.getStashFindings.mockResolvedValue([])
		gitServiceMock.getWorktreeFindings.mockResolvedValue([])
	})

	it("detects the default branch when the user does not provide --target", async () => {
		const { runApp } = await import("../index")
		await runApp()

		expect(gitServiceMock.getDefaultBranch).toHaveBeenCalledTimes(1)
		expect(gitServiceMock.getBranchFindings).toHaveBeenCalledWith(
			expect.objectContaining({
				ageDays: 30,
				include: ["branch"],
				targetBranch: "origin/main",
			}),
		)
	})

	it("prompts for an update before showing the welcome screen", async () => {
		versionMock.checkForUpdates.mockResolvedValue({
			currentVersion: "1.2.1",
			latestVersion: "1.3.0",
		})
		uiMock.promptForUpdate.mockResolvedValue(false)

		const { runApp } = await import("../index")
		await runApp()

		expect(versionMock.checkForUpdates).toHaveBeenCalledTimes(1)
		expect(uiMock.promptForUpdate).toHaveBeenCalledWith({
			currentVersion: "1.2.1",
			latestVersion: "1.3.0",
		})
		expect(uiMock.showWelcome).toHaveBeenCalledTimes(1)
	})

	it("installs the update and stops before scanning when the user accepts", async () => {
		versionMock.checkForUpdates.mockResolvedValue({
			currentVersion: "1.2.1",
			latestVersion: "1.3.0",
		})
		uiMock.promptForUpdate.mockResolvedValue(true)
		versionMock.installUpdate.mockResolvedValue({
			command: "pnpm install -g @kurokeita/git-clean-up@latest",
		})

		const { runApp } = await import("../index")
		await runApp()

		expect(versionMock.installUpdate).toHaveBeenCalledTimes(1)
		expect(gitServiceMock.pruneRemotes).not.toHaveBeenCalled()
		expect(uiMock.showDone).toHaveBeenCalledWith(
			expect.stringContaining("Updated git-clean-up"),
		)
	})

	it("re-scans after interactive stash cleanup and stops when findings are gone", async () => {
		cliMock.getParsedCommand.mockReturnValue({
			mode: "scan",
			options: {
				ageDays: 30,
				all: false,
				apply: false,
				include: ["stash"],
				json: false,
				target: undefined,
			},
		})

		const stashFinding = {
			category: "stash" as const,
			cleanupAction: {
				target: "stash@{0}",
				type: "drop-stash" as const,
			},
			fixable: true,
			id: "stash:stash@{0}:old",
			reason: "Older than 30 days",
			risk: "medium" as const,
			title: "stash@{0}: example",
		}

		gitServiceMock.getStashFindings
			.mockResolvedValueOnce([stashFinding])
			.mockResolvedValueOnce([stashFinding])
			.mockResolvedValueOnce([])
		uiMock.selectFindingCategory.mockResolvedValue("stash")
		uiMock.selectFindings.mockResolvedValue([stashFinding])
		uiMock.selectFindingAction.mockResolvedValue("apply")
		uiMock.confirmDeletion.mockResolvedValue(true)
		cleanupExecutorMock.run.mockResolvedValue(undefined)

		const { runApp } = await import("../index")
		await runApp()

		expect(gitServiceMock.getStashFindings).toHaveBeenCalledTimes(3)
		expect(cleanupExecutorMock.run).toHaveBeenCalledWith(
			[stashFinding],
			expect.anything(),
		)
		expect(uiMock.showDone).toHaveBeenCalledWith(
			"Your workspace is already clean! 🎉",
		)
	})

	it("force-deletes selected branches with unpushed commits after confirmation", async () => {
		cliMock.getParsedCommand.mockReturnValue({
			mode: "scan",
			options: {
				ageDays: 30,
				all: false,
				apply: false,
				include: ["branch"],
				json: false,
				target: undefined,
			},
		})

		const branchFinding = {
			category: "branch" as const,
			cleanupAction: {
				target: "feature/unpushed",
				type: "delete-branch" as const,
			},
			fixable: false,
			id: "branch:feature/unpushed:merged",
			reason: "Merged into main",
			risk: "high" as const,
			title: "feature/unpushed",
		}

		gitServiceMock.getBranchFindings
			.mockResolvedValueOnce([branchFinding])
			.mockResolvedValueOnce([])
		uiMock.selectFindingCategory.mockResolvedValue("branch")
		uiMock.selectFindings.mockResolvedValue([branchFinding])
		uiMock.promptForForceDelete.mockResolvedValue(true)
		uiMock.selectFindingAction.mockResolvedValue("apply")
		uiMock.confirmDeletion.mockResolvedValue(true)
		cleanupExecutorMock.run.mockResolvedValue(undefined)

		const { runApp } = await import("../index")
		await runApp()

		expect(uiMock.promptForForceDelete).toHaveBeenCalledWith([
			"feature/unpushed",
		])
		expect(cleanupExecutorMock.run).toHaveBeenCalledWith([branchFinding], {
			force: true,
		})
		expect(uiMock.showDone).toHaveBeenCalledWith(
			"Your workspace is already clean! 🎉",
		)
	})

	it("does not prompt for force-delete when the user previews non-fixable branch findings", async () => {
		cliMock.getParsedCommand.mockReturnValue({
			mode: "scan",
			options: {
				ageDays: 30,
				all: false,
				apply: false,
				include: ["branch"],
				json: false,
				target: undefined,
			},
		})

		const branchFinding = {
			category: "branch" as const,
			cleanupAction: {
				target: "feature/unpushed",
				type: "delete-branch" as const,
			},
			fixable: false,
			id: "branch:feature/unpushed:merged",
			reason: "Merged into main",
			risk: "high" as const,
			title: "feature/unpushed",
		}

		gitServiceMock.getBranchFindings.mockResolvedValue([branchFinding])
		uiMock.selectFindingCategory.mockResolvedValue("branch")
		uiMock.selectFindings.mockResolvedValue([branchFinding])
		uiMock.selectFindingAction.mockResolvedValue("preview")
		cleanupExecutorMock.previewCommands.mockReturnValue([])

		const { runApp } = await import("../index")
		await runApp()

		expect(uiMock.promptForForceDelete).not.toHaveBeenCalled()
		expect(cleanupExecutorMock.run).not.toHaveBeenCalled()
	})

	it("prompts to initialize a global config when no config files exist", async () => {
		uiMock.promptToCreateConfig = vi.fn().mockResolvedValue(true)
		configMock.loadCleanupPolicy
			.mockResolvedValueOnce({
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: undefined,
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
					skipPrune: false,
				},
			})
			.mockResolvedValueOnce({
				globalConfigPath: "/home/test/.git-clean-up.json",
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: undefined,
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
					skipPrune: false,
				},
			})

		const { runApp } = await import("../index")
		await runApp()

		expect(uiMock.promptToCreateConfig).toHaveBeenCalledWith(
			"global",
			"/home/test/.git-clean-up.json",
		)
		expect(configMock.initializeCleanupPolicyConfig).toHaveBeenCalledWith(
			"/home/test/.git-clean-up.json",
		)
	})

	it("prompts to initialize a local config when only a global config exists", async () => {
		uiMock.promptForConfigScopeChoice = vi.fn().mockResolvedValue("local")
		configMock.loadCleanupPolicy
			.mockResolvedValueOnce({
				globalConfigPath: "/home/test/.git-clean-up.json",
				globalPolicy: {
					includeCategories: ["branch"],
					stashAgeDays: 14,
				},
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: undefined,
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
					skipPrune: false,
				},
			})
			.mockResolvedValueOnce({
				globalConfigPath: "/home/test/.git-clean-up.json",
				localConfigPath: `${process.cwd()}/.git-clean-up.json`,
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: undefined,
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
					skipPrune: false,
				},
			})

		const { runApp } = await import("../index")
		await runApp()

		expect(uiMock.showNote).toHaveBeenCalledWith(
			expect.stringContaining(
				"Using global config from /home/test/.git-clean-up.json.",
			),
		)
		expect(uiMock.showNote).toHaveBeenCalledWith(
			expect.stringContaining("- includeCategories: branch"),
		)
		expect(uiMock.showNote).toHaveBeenCalledWith(
			expect.not.stringContaining('"includeCategories"'),
		)
		expect(uiMock.showNote).toHaveBeenCalledWith(
			expect.stringContaining("- stashAgeDays: 14"),
		)
		expect(uiMock.showNote).toHaveBeenCalledWith(
			expect.stringContaining(
				`Create local config at:\n${process.cwd()}/.git-clean-up.json`,
			),
		)
		expect(uiMock.showNote).toHaveBeenCalledWith(
			expect.stringContaining(
				`Using local config from ${process.cwd()}/.git-clean-up.json.`,
			),
		)
		expect(uiMock.showNote).toHaveBeenCalledTimes(2)
		expect(uiMock.promptForConfigScopeChoice).toHaveBeenCalledWith(
			`${process.cwd()}/.git-clean-up.json`,
		)
		expect(configMock.initializeCleanupPolicyConfig).toHaveBeenCalledWith(
			`${process.cwd()}/.git-clean-up.json`,
			expect.any(Object),
		)
	})

	it("shows local config details when a local config exists", async () => {
		configMock.loadCleanupPolicy.mockResolvedValue({
			globalConfigPath: "/home/test/.git-clean-up.json",
			localConfigPath: `${process.cwd()}/.git-clean-up.json`,
			localPolicy: {
				includeCategories: ["worktree"],
				stashAgeDays: 7,
			},
			policy: {
				branchExcludePatterns: [],
				branchInactiveDays: 90,
				defaultTargetBranch: undefined,
				divergedAheadCount: 10,
				divergedBehindCount: 10,
				includeCategories: ["worktree"],
				protectedBranches: ["main", "master", "develop", "dev"],
				stashAgeDays: 7,
				skipPrune: false,
			},
		})

		const { runApp } = await import("../index")
		await runApp()

		expect(uiMock.showNote).toHaveBeenCalledWith(
			expect.stringContaining(
				`Using local config from ${process.cwd()}/.git-clean-up.json.`,
			),
		)
		expect(uiMock.showNote).toHaveBeenCalledWith(
			expect.stringContaining("- includeCategories: worktree"),
		)
		expect(uiMock.showNote).toHaveBeenCalledWith(
			expect.not.stringContaining('"stashAgeDays"'),
		)
		expect(uiMock.showNote).toHaveBeenCalledWith(
			expect.stringContaining("- stashAgeDays: 7"),
		)
		expect(uiMock.promptForConfigScopeChoice).not.toHaveBeenCalled()
	})

	it("repairs an invalid configured default target branch by using the detected default", async () => {
		uiMock.promptToRepairDefaultTargetBranch = vi
			.fn()
			.mockResolvedValue("use-detected-default")
		configMock.loadCleanupPolicy.mockResolvedValue({
			defaultTargetBranchSourcePath: `${process.cwd()}/.git-clean-up.json`,
			localConfigPath: `${process.cwd()}/.git-clean-up.json`,
			policy: {
				branchExcludePatterns: [],
				branchInactiveDays: 90,
				defaultTargetBranch: "missing-branch",
				divergedAheadCount: 10,
				divergedBehindCount: 10,
				includeCategories: ["branch"],
				protectedBranches: ["main", "master", "develop", "dev"],
				stashAgeDays: 30,
				skipPrune: false,
			},
		})
		gitServiceMock.branchRefExists.mockResolvedValue(false)
		gitServiceMock.getDefaultBranch.mockResolvedValue("origin/main")

		const { runApp } = await import("../index")
		await runApp()

		expect(uiMock.promptToRepairDefaultTargetBranch).toHaveBeenCalledWith({
			configPath: `${process.cwd()}/.git-clean-up.json`,
			configuredTargetBranch: "missing-branch",
			detectedTargetBranch: "origin/main",
		})
		expect(configMock.updateCleanupPolicyFile).toHaveBeenCalledWith(
			`${process.cwd()}/.git-clean-up.json`,
			{ defaultTargetBranch: "origin/main" },
		)
		expect(gitServiceMock.getBranchFindings).toHaveBeenCalledWith(
			expect.objectContaining({ targetBranch: "origin/main" }),
		)
	})

	it("waits for a manual config fix when repairing an invalid target branch", async () => {
		uiMock.promptToRepairDefaultTargetBranch = vi
			.fn()
			.mockResolvedValue("fix-manually")
		configMock.loadCleanupPolicy
			.mockResolvedValueOnce({
				defaultTargetBranchSourcePath: `${process.cwd()}/.git-clean-up.json`,
				localConfigPath: `${process.cwd()}/.git-clean-up.json`,
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: "missing-branch",
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
				},
			})
			.mockResolvedValueOnce({
				defaultTargetBranchSourcePath: `${process.cwd()}/.git-clean-up.json`,
				localConfigPath: `${process.cwd()}/.git-clean-up.json`,
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: "origin/main",
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
				},
			})
		gitServiceMock.branchRefExists
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true)
		gitServiceMock.getDefaultBranch.mockResolvedValue("origin/main")
		configMock.waitForConfigChange.mockResolvedValue(undefined)

		const { runApp } = await import("../index")
		await runApp()

		expect(configMock.waitForConfigChange).toHaveBeenCalledWith(
			`${process.cwd()}/.git-clean-up.json`,
		)
		expect(gitServiceMock.getBranchFindings).toHaveBeenCalledWith(
			expect.objectContaining({ targetBranch: "origin/main" }),
		)
	})

	it("keeps prompting after manual edits until defaultTargetBranch becomes valid", async () => {
		uiMock.promptToRepairDefaultTargetBranch = vi
			.fn()
			.mockResolvedValue("fix-manually")
		configMock.loadCleanupPolicy
			.mockResolvedValueOnce({
				defaultTargetBranchSourcePath: `${process.cwd()}/.git-clean-up.json`,
				localConfigPath: `${process.cwd()}/.git-clean-up.json`,
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: "origin/m",
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
				},
			})
			.mockResolvedValueOnce({
				defaultTargetBranchSourcePath: `${process.cwd()}/.git-clean-up.json`,
				localConfigPath: `${process.cwd()}/.git-clean-up.json`,
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: "origin/m2",
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
				},
			})
			.mockResolvedValueOnce({
				defaultTargetBranchSourcePath: `${process.cwd()}/.git-clean-up.json`,
				localConfigPath: `${process.cwd()}/.git-clean-up.json`,
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: "origin/main",
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
				},
			})
		gitServiceMock.branchRefExists
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true)
		gitServiceMock.getDefaultBranch.mockResolvedValue("origin/main")
		configMock.waitForConfigChange.mockResolvedValue(undefined)

		const { runApp } = await import("../index")
		await runApp()

		expect(uiMock.promptToRepairDefaultTargetBranch).toHaveBeenCalledTimes(2)
		expect(uiMock.promptToRepairDefaultTargetBranch).toHaveBeenNthCalledWith(
			1,
			{
				configPath: `${process.cwd()}/.git-clean-up.json`,
				configuredTargetBranch: "origin/m",
				detectedTargetBranch: "origin/main",
			},
		)
		expect(uiMock.promptToRepairDefaultTargetBranch).toHaveBeenNthCalledWith(
			2,
			{
				configPath: `${process.cwd()}/.git-clean-up.json`,
				configuredTargetBranch: "origin/m2",
				detectedTargetBranch: "origin/main",
			},
		)
		expect(configMock.waitForConfigChange).toHaveBeenCalledTimes(2)
		expect(gitServiceMock.getBranchFindings).toHaveBeenCalledWith(
			expect.objectContaining({ targetBranch: "origin/main" }),
		)
	})

	it("keeps prompting when manual edits remove defaultTargetBranch instead of fixing it", async () => {
		uiMock.promptToRepairDefaultTargetBranch = vi
			.fn()
			.mockResolvedValue("fix-manually")
		configMock.loadCleanupPolicy
			.mockResolvedValueOnce({
				defaultTargetBranchSourcePath: `${process.cwd()}/.git-clean-up.json`,
				localConfigPath: `${process.cwd()}/.git-clean-up.json`,
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: "origin/m",
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
				},
			})
			.mockResolvedValueOnce({
				defaultTargetBranchSourcePath: `${process.cwd()}/.git-clean-up.json`,
				localConfigPath: `${process.cwd()}/.git-clean-up.json`,
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: undefined,
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
				},
			})
			.mockResolvedValueOnce({
				defaultTargetBranchSourcePath: `${process.cwd()}/.git-clean-up.json`,
				localConfigPath: `${process.cwd()}/.git-clean-up.json`,
				policy: {
					branchExcludePatterns: [],
					branchInactiveDays: 90,
					defaultTargetBranch: "origin/main",
					divergedAheadCount: 10,
					divergedBehindCount: 10,
					includeCategories: ["branch"],
					protectedBranches: ["main", "master", "develop", "dev"],
					stashAgeDays: 30,
				},
			})
		gitServiceMock.branchRefExists
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true)
		gitServiceMock.getDefaultBranch.mockResolvedValue("origin/main")
		configMock.waitForConfigChange.mockResolvedValue(undefined)

		const { runApp } = await import("../index")
		await runApp()

		expect(uiMock.promptToRepairDefaultTargetBranch).toHaveBeenCalledTimes(2)
		expect(uiMock.promptToRepairDefaultTargetBranch).toHaveBeenNthCalledWith(
			1,
			{
				configPath: `${process.cwd()}/.git-clean-up.json`,
				configuredTargetBranch: "origin/m",
				detectedTargetBranch: "origin/main",
			},
		)
		expect(uiMock.promptToRepairDefaultTargetBranch).toHaveBeenNthCalledWith(
			2,
			{
				configPath: `${process.cwd()}/.git-clean-up.json`,
				configuredTargetBranch: "",
				detectedTargetBranch: "origin/main",
			},
		)
		expect(configMock.waitForConfigChange).toHaveBeenCalledTimes(2)
	})
})
