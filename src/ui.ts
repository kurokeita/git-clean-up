import * as p from "@clack/prompts"
import color from "picocolors"
import type { CleanupCategory, CleanupFinding } from "./cleanup.types"
import { APP_NAME, getVersion } from "./version"

export interface GroupedFindings {
	branch: CleanupFinding[]
	stash: CleanupFinding[]
	worktree: CleanupFinding[]
}

export function formatVersionBanner() {
	return color.bgCyan(color.black(` ${APP_NAME} v${getVersion()} `))
}

function withVersionHeader(message: string): string {
	return `${formatVersionBanner()}\n${message}`
}

export async function showWelcome() {
	p.intro(formatVersionBanner())
}

export async function showDone(message: string) {
	p.outro(color.green(message))
}

export async function showCancel(message: string) {
	p.cancel(color.red(message))
}

export function groupFindingsByCategory(
	findings: CleanupFinding[],
): GroupedFindings {
	return findings.reduce<GroupedFindings>(
		(grouped, finding) => {
			grouped[finding.category].push(finding)
			return grouped
		},
		{
			branch: [],
			stash: [],
			worktree: [],
		},
	)
}

export function formatFindingLabel(finding: CleanupFinding): string {
	return `${finding.title} ${color.dim(`[${finding.risk}] ${finding.reason}`)}`
}

export function serializeFindings(findings: CleanupFinding[]): string {
	return JSON.stringify(findings, null, 2)
}

function getCategoryLabel(category: CleanupCategory): string {
	switch (category) {
		case "branch":
			return "Branches"
		case "stash":
			return "Stashes"
		case "worktree":
			return "Worktrees"
	}
}

export function getCategoryOptions(grouped: GroupedFindings) {
	return (Object.keys(grouped) as CleanupCategory[])
		.filter((category) => grouped[category].length > 0)
		.map((category) => ({
			label: `${getCategoryLabel(category)} (${grouped[category].length})`,
			value: category,
		}))
}

export async function selectFindingCategory(
	findings: CleanupFinding[],
): Promise<CleanupCategory | undefined> {
	const grouped = groupFindingsByCategory(findings)
	const options = getCategoryOptions(grouped)

	if (options.length === 0) {
		p.note("No cleanup findings found.")
		return undefined
	}

	const selectedCategory = await p.select({
		message: withVersionHeader("Choose a category to review"),
		options: [
			...options,
			{
				label: "Exit",
				value: "exit",
			},
		],
	})

	if (p.isCancel(selectedCategory) || selectedCategory === "exit") {
		return undefined
	}

	return selectedCategory as CleanupCategory
}

export async function inspectFindings(
	findings: CleanupFinding[],
): Promise<void> {
	const grouped = groupFindingsByCategory(findings)
	const selectedCategory = await selectFindingCategory(findings)

	if (!selectedCategory) {
		return
	}

	p.note(grouped[selectedCategory].map(formatFindingLabel).join("\n"))
}

export async function selectFindings(
	findings: CleanupFinding[],
): Promise<CleanupFinding[]> {
	if (findings.length === 0) {
		p.note("No findings found for cleanup.")
		return []
	}

	const selected = await p.multiselect({
		message: withVersionHeader("Select findings to clean"),
		options: findings.map((finding) => ({
			label: formatFindingLabel(finding),
			value: finding.id,
		})),
		required: false,
	})

	if (p.isCancel(selected)) {
		return []
	}

	const selectedIds = new Set(selected as string[])
	return findings.filter((finding) => selectedIds.has(finding.id))
}

export async function selectFindingAction(
	count: number,
): Promise<"preview" | "apply" | "back" | "exit"> {
	const selectedAction = await p.select({
		message: withVersionHeader(
			`Choose what to do with ${count} selected findings`,
		),
		options: [
			{
				label: "Preview cleanup",
				value: "preview",
			},
			{
				label: "Apply cleanup",
				value: "apply",
			},
			{
				label: "Back",
				value: "back",
			},
			{
				label: "Exit",
				value: "exit",
			},
		],
	})

	if (p.isCancel(selectedAction)) {
		return "exit"
	}

	return selectedAction as "preview" | "apply" | "back" | "exit"
}

export function showNote(message: string) {
	p.note(message)
}

export async function confirmDeletion(count: number): Promise<boolean> {
	const confirmed = await p.confirm({
		message: withVersionHeader(
			`Are you sure you want to apply ${count} cleanup actions?`,
		),
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
