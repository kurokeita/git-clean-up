import { execa } from "execa"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { CleanupFinding } from "../cleanup.types"
import { CleanupExecutor } from "../cleanup-executor"

vi.mock("execa")

describe(CleanupExecutor.name, () => {
	const executor = new CleanupExecutor()

	const finding = (id: string): CleanupFinding => ({
		category: "branch",
		cleanupAction: {
			target: "feature/demo",
			type: "delete-branch",
		},
		fixable: true,
		id,
		reason: "Merged into main",
		risk: "low",
		title: "feature/demo",
	})

	beforeEach(() => {
		vi.clearAllMocks()
		vi.mocked(execa).mockResolvedValue({ stdout: "" } as never)
	})

	it("deduplicates cleanup actions that target the same resource", async () => {
		await executor.run([
			finding("branch:feature/demo:merged"),
			finding("branch:feature/demo:no-upstream"),
		])

		expect(execa).toHaveBeenCalledTimes(1)
		expect(execa).toHaveBeenCalledWith("git", ["branch", "-D", "feature/demo"])
	})

	it("renders dry-run commands for selected findings", () => {
		const commands = executor.previewCommands([
			finding("branch:feature/demo:merged"),
			{
				...finding("stash:stash@{0}:old"),
				category: "stash",
				cleanupAction: {
					target: "stash@{0}",
					type: "drop-stash",
				},
				title: "stash@{0}",
			},
		])

		expect(commands).toEqual([
			"git branch -D feature/demo",
			"git stash drop stash@{0}",
		])
	})

	it("sorts stash cleanup actions by index in descending order in run()", async () => {
		await executor.run([
			{
				...finding("stash:stash@{0}:old"),
				category: "stash",
				cleanupAction: { target: "stash@{0}", type: "drop-stash" },
			},
			{
				...finding("stash:stash@{2}:old"),
				category: "stash",
				cleanupAction: { target: "stash@{2}", type: "drop-stash" },
			},
			{
				...finding("stash:stash@{1}:old"),
				category: "stash",
				cleanupAction: { target: "stash@{1}", type: "drop-stash" },
			},
		])

		expect(vi.mocked(execa)).toHaveBeenCalledTimes(3)
		const calls = vi.mocked(execa).mock.calls
		expect(calls[0][1]).toContain("stash@{2}")
		expect(calls[1][1]).toContain("stash@{1}")
		expect(calls[2][1]).toContain("stash@{0}")
	})

	it("sorts stash cleanup actions by index in descending order in previewCommands()", () => {
		const commands = executor.previewCommands([
			{
				...finding("stash:stash@{0}:old"),
				category: "stash",
				cleanupAction: { target: "stash@{0}", type: "drop-stash" },
			},
			{
				...finding("stash:stash@{1}:old"),
				category: "stash",
				cleanupAction: { target: "stash@{1}", type: "drop-stash" },
			},
		])

		expect(commands).toEqual([
			"git stash drop stash@{1}",
			"git stash drop stash@{0}",
		])
	})
})
