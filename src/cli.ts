import { Command } from "commander"
import type { CleanupCategory } from "./cleanup.types"
import { APP_NAME, getVersion } from "./version"

export interface CliOptions {
	target?: string
	include?: CleanupCategory[]
	json: boolean
	apply: boolean
	ageDays?: number
	all: boolean
	summary: boolean
	failOn?: string
	maxFindings?: number
	skipPrune?: boolean
}

export interface ParsedCommand {
	mode: "scan" | "clean"
	options: CliOptions
}

function parseInclude(value?: string): CleanupCategory[] | undefined {
	if (!value) {
		return undefined
	}

	const categories = value
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean)
		.map((entry) => {
			switch (entry) {
				case "branch":
				case "branches":
					return "branch"
				case "stash":
				case "stashes":
					return "stash"
				case "worktree":
				case "worktrees":
					return "worktree"
				default:
					throw new Error(`Unsupported cleanup category: ${entry}`)
			}
		})

	return categories.length > 0 ? categories : undefined
}

function collectOptions(options: {
	target?: string
	include?: string
	json?: boolean
	apply?: boolean
	ageDays?: number
	all?: boolean
	summary?: boolean
	failOn?: string
	maxFindings?: number
	skipPrune?: boolean
}): CliOptions {
	return {
		ageDays:
			typeof options.ageDays === "string"
				? Number(options.ageDays)
				: options.ageDays,
		all: options.all ?? false,
		apply: options.apply ?? false,
		failOn: options.failOn,
		include: parseInclude(options.include),
		json: options.json ?? false,
		maxFindings:
			typeof options.maxFindings === "string"
				? Number(options.maxFindings)
				: options.maxFindings,
		summary: options.summary ?? false,
		skipPrune: options.skipPrune,
		target: options.target,
	}
}

function addSharedOptions(command: Command): Command {
	return command
		.option("-t, --target <branch>", "Target branch to check for merges")
		.option(
			"-i, --include <categories>",
			"Comma-separated categories: branches, stashes, worktrees",
		)
		.option("--json", "Output findings as JSON", false)
		.option(
			"--age-days <days>",
			"Age threshold for stash/worktree findings",
			(value) => Number(value),
		)
		.option("-a, --all", "Select all findings without interaction", false)
		.option("--summary", "Output a concise summary of findings", false)
		.option(
			"--fail-on <risk>",
			"Fail (exit 1) if findings with this risk level or higher are found (low, medium, high)",
		)
		.option(
			"--max-findings <number>",
			"Fail (exit 1) if total findings exceed this number",
			(value) => Number(value),
		)
		.option("--skip-prune", "Skip the initial remote prune step")
}

export function createCli() {
	const program = new Command()
	let parsedCommand: ParsedCommand = {
		mode: "scan",
		options: collectOptions({}),
	}

	addSharedOptions(
		program
			.name(APP_NAME)
			.description(
				"Audit-first CLI tool to clean up local git repository hygiene",
			)
			.version(getVersion(), "-v, --version")
			.argument("[mode]", "scan or clean", "scan")
			.option("--apply", "Apply the selected cleanup actions", false),
	).action((mode: string, options) => {
		parsedCommand = {
			mode: mode === "clean" ? "clean" : "scan",
			options: collectOptions(options),
		}
	})

	return {
		getParsedCommand() {
			return parsedCommand
		},
		program,
	}
}
