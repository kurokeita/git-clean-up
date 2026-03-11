import { describe, expect, it } from "vitest"
import type { CleanupFinding } from "../cleanup.types"
import {
	formatFindingLabel,
	getCategoryOptions,
	groupFindingsByCategory,
	serializeFindings,
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
})
