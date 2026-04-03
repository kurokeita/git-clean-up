import * as p from "@clack/prompts"
import color from "picocolors"
import type { CleanupCategory, CleanupFinding } from "./cleanup.types"
import { APP_NAME, getVersion, type UpdateInfo } from "./version"

export interface GroupedFindings {
	branch: CleanupFinding[]
	stash: CleanupFinding[]
	worktree: CleanupFinding[]
}

export function formatVersionBanner() {
	return color.bgCyan(color.black(` ${APP_NAME} v${getVersion()} `))
}

function withVersionHeader(message: string): string {
	return message
}

export async function showWelcome() {
	p.intro(formatVersionBanner())
}

export async function promptForUpdate(
	updateInfo: UpdateInfo,
): Promise<boolean> {
	const confirmed = await p.confirm({
		initialValue: true,
		message: withVersionHeader(
			`A new version is available (${updateInfo.currentVersion} -> ${updateInfo.latestVersion}). Update now?`,
		),
	})

	if (p.isCancel(confirmed)) {
		return false
	}

	return confirmed as boolean
}

/** Prompts whether to create a missing global or local config file. */
export async function promptToCreateConfig(
	scope: "global" | "local",
	configPath: string,
): Promise<boolean> {
	const confirmed = await p.confirm({
		initialValue: true,
		message: withVersionHeader(
			`No ${scope} config was found. Create one at ${configPath}?`,
		),
	})

	if (p.isCancel(confirmed)) {
		return false
	}

	return confirmed as boolean
}

/** Prompts whether to keep using the global config or create a local one. */
export async function promptForConfigScopeChoice(
	globalConfigPath: string,
	localConfigPath: string,
): Promise<"global" | "local" | "exit"> {
	const selectedAction = await p.select({
		message: withVersionHeader(
			`Using global config at ${globalConfigPath}. Keep using it or create a local config at ${localConfigPath}?`,
		),
		options: [
			{ label: "Keep using global config", value: "global" },
			{ label: "Create local config", value: "local" },
			{ label: "Exit", value: "exit" },
		],
	})

	if (p.isCancel(selectedAction)) {
		return "exit"
	}

	return selectedAction as "global" | "local" | "exit"
}

/** Prompts how to repair an invalid configured defaultTargetBranch. */
export async function promptToRepairDefaultTargetBranch({
	configPath,
	configuredTargetBranch,
	detectedTargetBranch,
}: {
	configPath: string
	configuredTargetBranch: string
	detectedTargetBranch: string
}): Promise<"use-detected-default" | "fix-manually" | "exit"> {
	const selectedAction = await p.select({
		message: withVersionHeader(
			`Configured defaultTargetBranch \`${configuredTargetBranch}\` from ${configPath} does not exist. Use detected branch \`${detectedTargetBranch}\` or fix the config manually?`,
		),
		options: [
			{
				label: `Use detected branch (${detectedTargetBranch})`,
				value: "use-detected-default",
			},
			{ label: "Fix the config file manually", value: "fix-manually" },
			{ label: "Exit", value: "exit" },
		],
	})

	if (p.isCancel(selectedAction)) {
		return "exit"
	}

	return selectedAction as "use-detected-default" | "fix-manually" | "exit"
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
	const detailParts: string[] = []

	if (finding.details?.lastCommitAgeDays !== undefined) {
		detailParts.push(`${finding.details.lastCommitAgeDays}d old`)
	}

	if (
		finding.details?.behindCount !== undefined &&
		finding.details?.aheadCount !== undefined
	) {
		detailParts.push(
			`behind ${finding.details.behindCount} / ahead ${finding.details.aheadCount}`,
		)
	}

	if (finding.details?.upstream) {
		detailParts.push(`upstream ${finding.details.upstream}`)
	}

	if (finding.details?.lastCommitAuthor) {
		detailParts.push(`author ${finding.details.lastCommitAuthor}`)
	}

	const safetyWarnings = finding.details?.safetyWarnings ?? []
	const coloredWarnings = safetyWarnings.map((w) => color.red(w))

	const detailSuffix =
		detailParts.length > 0 ? ` · ${detailParts.join(" · ")}` : ""

	const warningSuffix =
		coloredWarnings.length > 0 ? ` · ${coloredWarnings.join(" · ")}` : ""

	const riskLabel =
		finding.risk === "high"
			? color.red(`[${finding.risk}]`)
			: finding.risk === "medium"
				? color.yellow(`[${finding.risk}]`)
				: color.blue(`[${finding.risk}]`)

	const fixablePrefix = finding.fixable ? "" : color.red("✖ ")

	return `${fixablePrefix}${finding.title} ${riskLabel} ${color.dim(`${finding.reason}${detailSuffix}`)}${warningSuffix}`
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

export function showSummary(findings: CleanupFinding[]) {
	const high = findings.filter((f) => f.risk === "high").length
	const medium = findings.filter((f) => f.risk === "medium").length
	const low = findings.filter((f) => f.risk === "low").length

	const parts = [
		`Total findings: ${findings.length}`,
		high > 0 ? color.red(`${high} high risk`) : "",
		medium > 0 ? color.yellow(`${medium} medium risk`) : "",
		low > 0 ? color.blue(`${low} low risk`) : "",
	].filter(Boolean)

	p.note(parts.join(" · "), "Scan Summary")
}

export function createSpinner() {
	return p.spinner()
}
