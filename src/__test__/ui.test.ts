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
	formatFindingLabel,
	formatVersionBanner,
	getCategoryOptions,
	groupFindingsByCategory,
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

	it("serializes findings for json output", () => {
		const output = serializeFindings([finding({ category: "worktree" })])
		expect(output).toContain('"category": "worktree"')
		expect(output).toContain('"fixable": true')
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
})
