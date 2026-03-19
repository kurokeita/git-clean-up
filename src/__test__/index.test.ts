import { beforeEach, describe, expect, it, vi } from "vitest"

const uiMock = vi.hoisted(() => ({
	confirmDeletion: vi.fn(),
	createSpinner: vi.fn(() => ({
		message: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
	})),
	formatFindingLabel: vi.fn((finding) => finding.title),
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
	getDefaultBranch: vi.fn(),
	getBranchFindings: vi.fn(),
	getStashFindings: vi.fn(),
	getWorktreeFindings: vi.fn(),
	pruneRemotes: vi.fn(),
}))

const cleanupExecutorMock = vi.hoisted(() => ({
	previewCommands: vi.fn(),
	run: vi.fn(),
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
		cliMock.program.parse.mockReset()
		cliMock.getParsedCommand.mockReset()
		uiMock.showWelcome.mockReset()
		uiMock.showDone.mockReset()
		uiMock.showCancel.mockReset()
		uiMock.showNote.mockReset()
		uiMock.promptForUpdate.mockReset()
		uiMock.createSpinner.mockClear()
		versionMock.checkForUpdates.mockReset()
		versionMock.installUpdate.mockReset()
		gitServiceMock.pruneRemotes.mockReset()
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
		gitServiceMock.pruneRemotes.mockResolvedValue(undefined)
		gitServiceMock.getDefaultBranch.mockResolvedValue("origin/main")
		gitServiceMock.getBranchFindings.mockResolvedValue([])
		gitServiceMock.getStashFindings.mockResolvedValue([])
		gitServiceMock.getWorktreeFindings.mockResolvedValue([])
	})

	it("detects the default branch when the user does not provide --target", async () => {
		const { runApp } = await import("../index")
		await runApp()

		expect(gitServiceMock.getDefaultBranch).toHaveBeenCalledTimes(1)
		expect(gitServiceMock.getBranchFindings).toHaveBeenCalledWith({
			ageDays: 30,
			include: ["branch"],
			targetBranch: "origin/main",
		})
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
		expect(cleanupExecutorMock.run).toHaveBeenCalledWith([stashFinding])
		expect(uiMock.showDone).toHaveBeenCalledWith("Your workspace is already clean! 🎉")
	})
})
