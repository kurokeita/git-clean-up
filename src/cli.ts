import { Command } from "commander"
import type { CleanupCategory } from "./cleanup.types"

export interface CliOptions {
	target: string
	include: CleanupCategory[]
	json: boolean
	apply: boolean
	ageDays: number
	all: boolean
}

export interface ParsedCommand {
	mode: "scan" | "clean"
	options: CliOptions
}

const DEFAULT_INCLUDE: CleanupCategory[] = ["branch", "stash", "worktree"]

function parseInclude(value?: string): CleanupCategory[] {
	if (!value) {
		return DEFAULT_INCLUDE
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

	return categories.length > 0 ? categories : DEFAULT_INCLUDE
}

function collectOptions(options: {
	target?: string
	include?: string
	json?: boolean
	apply?: boolean
	ageDays?: number
	all?: boolean
}): CliOptions {
	return {
		ageDays:
			typeof options.ageDays === "string"
				? Number(options.ageDays)
				: (options.ageDays ?? 30),
		all: options.all ?? false,
		apply: options.apply ?? false,
		include: parseInclude(options.include),
		json: options.json ?? false,
		target: options.target ?? "main",
	}
}

function addSharedOptions(command: Command): Command {
	return command
		.option(
			"-t, --target <branch>",
			"Target branch to check for merges",
			"main",
		)
		.option(
			"-i, --include <categories>",
			"Comma-separated categories: branches, stashes, worktrees",
		)
		.option("--json", "Output findings as JSON", false)
		.option(
			"--age-days <days>",
			"Age threshold for stash/worktree findings",
			(value) => Number(value),
			30,
		)
		.option("-a, --all", "Select all findings without interaction", false)
}

export function createCli() {
	const program = new Command()
	let parsedCommand: ParsedCommand = {
		mode: "scan",
		options: collectOptions({}),
	}

	addSharedOptions(
		program
			.name("git-clean-up")
			.description(
				"Audit-first CLI tool to clean up local git repository hygiene",
			)
			.version("0.1.0")
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
