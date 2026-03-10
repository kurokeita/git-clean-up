import { Command } from "commander"

export function createProgram() {
	const program = new Command()

	program
		.name("git-clean-up")
		.description("Interactive CLI tool to clean up local git branches")
		.version("0.1.0")
		.option("-d, --dry-run", "Preview changes without deleting branches", false)
		.option(
			"-a, --all",
			"Select all branches found for cleanup without interaction",
			false,
		)
		.option(
			"-t, --target <branch>",
			"Target branch to check for merges",
			"main",
		)
	return program
}
