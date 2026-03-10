import { describe, expect, it } from "vitest"
import { createProgram } from "../cli"

describe("CLI Command Parsing", () => {
	it("should have default options", () => {
		const program = createProgram()
		program.parse([], { from: "user" })
		const options = program.opts()

		expect(options.dryRun).toBe(false)
		expect(options.target).toBe("main")
	})

	it("should parse --dry-run flag", () => {
		const program = createProgram()
		program.parse(["--dry-run"], { from: "user" })
		const options = program.opts()

		expect(options.dryRun).toBe(true)
	})

	it("should parse --target option", () => {
		const program = createProgram()
		program.parse(["--target", "develop"], { from: "user" })
		const options = program.opts()

		expect(options.target).toBe("develop")
	})
})
