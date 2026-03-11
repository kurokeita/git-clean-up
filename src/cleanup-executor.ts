import { execa } from "execa"
import type { CleanupFinding } from "./cleanup.types"

export class CleanupExecutor {
	previewCommands(findings: CleanupFinding[]): string[] {
		const seenActions = new Set<string>()
		const commands: string[] = []

		for (const finding of findings) {
			if (!finding.fixable) {
				continue
			}

			const actionKey = `${finding.cleanupAction.type}:${finding.cleanupAction.target}`
			if (seenActions.has(actionKey)) {
				continue
			}
			seenActions.add(actionKey)

			commands.push(this.toCommandString(finding))
		}

		return commands
	}

	async run(findings: CleanupFinding[]): Promise<void> {
		const seenActions = new Set<string>()

		for (const finding of findings) {
			if (!finding.fixable) {
				continue
			}

			const actionKey = `${finding.cleanupAction.type}:${finding.cleanupAction.target}`
			if (seenActions.has(actionKey)) {
				continue
			}
			seenActions.add(actionKey)

			const [command, ...args] = this.toCommandArgs(finding)
			await execa(command, args)
		}
	}

	private toCommandArgs(finding: CleanupFinding): [string, ...string[]] {
		switch (finding.cleanupAction.type) {
			case "delete-branch":
				return ["git", "branch", "-D", finding.cleanupAction.target]
			case "drop-stash":
				return ["git", "stash", "drop", finding.cleanupAction.target]
			case "remove-worktree":
				return [
					"git",
					"worktree",
					"remove",
					"--force",
					finding.cleanupAction.target,
				]
		}
	}

	private toCommandString(finding: CleanupFinding): string {
		return this.toCommandArgs(finding).join(" ")
	}
}
