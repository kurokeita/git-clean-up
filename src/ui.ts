import * as p from "@clack/prompts"
import color from "picocolors"

export async function showWelcome() {
	p.intro(color.bgCyan(color.black(" git-clean-up ")))
}

export async function showDone(message: string) {
	p.outro(color.green(message))
}

export async function showCancel(message: string) {
	p.cancel(color.red(message))
}

export async function selectBranches(
	branches: { name: string; reason: string }[],
): Promise<string[]> {
	if (branches.length === 0) {
		p.note("No branches found for cleanup.")
		return []
	}

	const options = branches.map((b) => ({
		value: b.name,
		label: `${b.name} ${color.dim(`(${b.reason})`)}`,
	}))

	const selected = await p.multiselect({
		message: "Select branches to delete",
		options,
		required: false,
	})

	if (p.isCancel(selected)) {
		return []
	}

	return selected as string[]
}

export async function confirmDeletion(count: number): Promise<boolean> {
	const confirmed = await p.confirm({
		message: `Are you sure you want to delete ${count} branches?`,
		initialValue: false,
	})

	if (p.isCancel(confirmed)) {
		return false
	}

	return confirmed as boolean
}

export function createSpinner() {
	return p.spinner()
}
