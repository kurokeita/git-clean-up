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
})
