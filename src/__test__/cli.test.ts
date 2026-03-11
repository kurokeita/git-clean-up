import { describe, expect, it } from "vitest"
import packageJson from "../../package.json"
import { createCli } from "../cli"

describe("CLI Command Parsing", () => {
	const parseVersionOutput = (args: string[]) => {
		const cli = createCli()
		let stdout = ""

		cli.program.exitOverride()
		cli.program.configureOutput({
			writeErr() {},
			writeOut(str) {
				stdout += str
			},
		})

		try {
			cli.program.parse(args, { from: "user" })
		} catch {
			// Commander exits after printing version output.
		}

		return stdout.trim()
	}

	it("defaults to scan mode with audit-first options", () => {
		const cli = createCli()
		cli.program.parse([], { from: "user" })

		expect(cli.getParsedCommand()).toEqual({
			mode: "scan",
			options: {
				ageDays: 30,
				all: false,
				apply: false,
				include: ["branch", "stash", "worktree"],
				json: false,
				target: "main",
			},
		})
	})

	it("parses the scan command with include filters", () => {
		const cli = createCli()
		cli.program.parse(["scan", "--include", "branches,worktrees", "--json"], {
			from: "user",
		})

		expect(cli.getParsedCommand()).toEqual({
			mode: "scan",
			options: {
				ageDays: 30,
				all: false,
				apply: false,
				include: ["branch", "worktree"],
				json: true,
				target: "main",
			},
		})
	})

	it("parses the clean command with apply mode", () => {
		const cli = createCli()
		cli.program.parse(
			["clean", "--target", "develop", "--apply", "--age-days", "14"],
			{
				from: "user",
			},
		)

		expect(cli.getParsedCommand()).toEqual({
			mode: "clean",
			options: {
				ageDays: 14,
				all: false,
				apply: true,
				include: ["branch", "stash", "worktree"],
				json: false,
				target: "develop",
			},
		})
	})

	it("prints the package version for --version", () => {
		expect(parseVersionOutput(["--version"])).toBe(packageJson.version)
	})

	it("supports the -v alias for version output", () => {
		expect(parseVersionOutput(["-v"])).toBe(packageJson.version)
	})

	it("uses the package version as the commander version source", () => {
		const cli = createCli()

		expect(cli.program.version()).toBe(packageJson.version)
	})
})
