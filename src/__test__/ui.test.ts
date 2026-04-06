import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CleanupFinding } from "../cleanup.types"

const promptsMock = vi.hoisted(() => ({
	cancel: vi.fn(),
	confirm: vi.fn(),
	intro: vi.fn(),
	multiselect: vi.fn(),
	note: vi.fn(),
	outro: vi.fn(),
	select: vi.fn(),
	spinner: vi.fn(() => ({
		message: vi.fn(),
		start: vi.fn(),
		stop: vi.fn(),
	})),
}))

vi.mock("@clack/prompts", () => ({
	cancel: promptsMock.cancel,
	confirm: promptsMock.confirm,
	intro: promptsMock.intro,
	isCancel: () => false,
	multiselect: promptsMock.multiselect,
	note: promptsMock.note,
	outro: promptsMock.outro,
	select: promptsMock.select,
	spinner: promptsMock.spinner,
}))

import {
	formatConfigScopeNote,
	formatFindingLabel,
	formatVersionBanner,
	getCategoryOptions,
	groupFindingsByCategory,
	promptForConfigScopeChoice,
	promptForUpdate,
	promptToCreateConfig,
	promptToRepairDefaultTargetBranch,
	serializeFindings,
	showWelcome,
} from "../ui"

const finding = (overrides: Partial<CleanupFinding>): CleanupFinding => ({
	category: "branch",
	cleanupAction: {
		target: "feature/demo",
		type: "delete-branch",
	},
	fixable: true,
	id: "branch:feature/demo:merged",
	reason: "Merged into main",
	risk: "low",
	title: "feature/demo",
	...overrides,
})

describe("ui helpers", () => {
	beforeEach(() => {
		promptsMock.intro.mockReset()
		promptsMock.note.mockReset()
		promptsMock.cancel.mockReset()
		promptsMock.outro.mockReset()
		promptsMock.select.mockReset()
		promptsMock.multiselect.mockReset()
		promptsMock.confirm.mockReset()
		promptsMock.spinner.mockClear()
	})

	it("groups findings by category", () => {
		const grouped = groupFindingsByCategory([
			finding({ category: "stash", id: "stash:0:old", title: "stash@{0}" }),
			finding({ category: "branch" }),
		])

		expect(grouped.branch).toHaveLength(1)
		expect(grouped.stash).toHaveLength(1)
		expect(grouped.worktree).toHaveLength(0)
	})

	it("formats findings with risk and reason", () => {
		expect(formatFindingLabel(finding({ risk: "medium" }))).toContain(
			"feature/demo",
		)
		expect(formatFindingLabel(finding({ risk: "medium" }))).toContain("medium")
		expect(formatFindingLabel(finding({ risk: "medium" }))).toContain(
			"Merged into main",
		)
	})

	it("formats structured finding details without changing the JSON payload", () => {
		const label = formatFindingLabel(
			finding({
				details: {
					aheadCount: 1,
					behindCount: 12,
					lastCommitAgeDays: 45,
					lastCommitAuthor: "Test User",
					upstream: "origin/feature/demo",
				},
			}),
		)

		expect(label).toContain("45d old")
		expect(label).toContain("behind 12 / ahead 1")
		expect(label).toContain("origin/feature/demo")
		expect(label).toContain("Test User")
	})

	it("serializes findings for json output", () => {
		const output = serializeFindings([
			finding({
				category: "worktree",
				details: {
					safetyWarnings: ["Has unpushed commits"],
				},
			}),
		])
		expect(output).toContain('"category": "worktree"')
		expect(output).toContain('"fixable": true')
		expect(output).toContain('"safetyWarnings"')
	})

	it("builds category options from grouped findings", () => {
		const options = getCategoryOptions(
			groupFindingsByCategory([
				finding({ category: "branch" }),
				finding({ category: "stash", id: "stash:0:old", title: "stash@{0}" }),
			]),
		)

		expect(options).toEqual([
			{ label: "Branches (1)", value: "branch" },
			{ label: "Stashes (1)", value: "stash" },
		])
	})

	it("formats a version banner with the app name and version", () => {
		const banner = formatVersionBanner()

		expect(banner).toContain("git-clean-up")
		expect(banner).toContain("v")
	})

	it("shows the version banner in the welcome intro", async () => {
		await showWelcome()

		expect(promptsMock.intro).toHaveBeenCalledTimes(1)
		expect(promptsMock.intro.mock.calls[0]?.[0]).toContain("git-clean-up")
		expect(promptsMock.intro.mock.calls[0]?.[0]).toContain("v")
	})

	it("prompts with the current and latest versions before updating", async () => {
		promptsMock.confirm.mockResolvedValue(true)

		const accepted = await promptForUpdate({
			currentVersion: "1.2.1",
			latestVersion: "1.3.0",
		})

		expect(accepted).toBe(true)
		expect(promptsMock.confirm).toHaveBeenCalledTimes(1)
		expect(promptsMock.confirm.mock.calls[0]?.[0].message).toContain("1.2.1")
		expect(promptsMock.confirm.mock.calls[0]?.[0].message).toContain("1.3.0")
	})

	it("prompts to create a config file at a given scope", async () => {
		promptsMock.confirm.mockResolvedValue(true)

		await expect(
			promptToCreateConfig("global", "/home/test/.git-clean-up.json"),
		).resolves.toBe(true)
		expect(promptsMock.confirm.mock.calls[0]?.[0].message).toContain("global")
		expect(promptsMock.confirm.mock.calls[0]?.[0].message).toContain(
			"/home/test/.git-clean-up.json",
		)
	})

	it("prompts to choose between the global config and creating a local one", async () => {
		promptsMock.select.mockResolvedValue("local")

		await expect(
			promptForConfigScopeChoice("/repo/.git-clean-up.json"),
		).resolves.toBe("local")
		expect(promptsMock.select.mock.calls[0]?.[0].message).toBe("Config scope")
		expect(promptsMock.select.mock.calls[0]?.[0].options).toEqual([
			{ label: "Keep using global config", value: "global" },
			{
				label: "Create local config at /repo/.git-clean-up.json",
				value: "local",
			},
			{ label: "Exit", value: "exit" },
		])
	})

	it("formats a global config note as a compact summary instead of raw json", () => {
		const note = formatConfigScopeNote({
			scope: "global",
			configPath: "/home/test/.git-clean-up.json",
			configPolicy: {
				includeCategories: ["branch", "worktree"],
				stashAgeDays: 14,
			},
			localConfigPath: "/repo/.git-clean-up.json",
		})

		expect(note).toContain(
			"Using global config from /home/test/.git-clean-up.json.",
		)
		expect(note).toContain("Current global config:")
		expect(note).toContain("- includeCategories: branch, worktree")
		expect(note).toContain("- stashAgeDays: 14")
		expect(note).toContain("Create local config at:\n/repo/.git-clean-up.json")
		expect(note).not.toContain("{")
		expect(note).not.toContain('"includeCategories"')
	})

	it("formats a local config note as a compact summary instead of raw json", () => {
		const note = formatConfigScopeNote({
			scope: "local",
			configPath: "/repo/.git-clean-up.json",
			configPolicy: {
				defaultTargetBranch: "origin/main",
				stashAgeDays: 7,
			},
		})

		expect(note).toContain("Using local config from /repo/.git-clean-up.json.")
		expect(note).toContain("Current local config:")
		expect(note).toContain("- defaultTargetBranch: origin/main")
		expect(note).toContain("- stashAgeDays: 7")
		expect(note).not.toContain("{")
		expect(note).not.toContain('"stashAgeDays"')
	})

	it("prompts to repair an invalid configured target branch", async () => {
		promptsMock.select.mockResolvedValue("use-detected-default")

		await expect(
			promptToRepairDefaultTargetBranch({
				configPath: "/repo/.git-clean-up.json",
				configuredTargetBranch: "missing-branch",
				detectedTargetBranch: "origin/main",
			}),
		).resolves.toBe("use-detected-default")
		expect(promptsMock.select.mock.calls[0]?.[0].message).toContain(
			"missing-branch",
		)
		expect(promptsMock.select.mock.calls[0]?.[0].message).toContain(
			"origin/main",
		)
	})
})
