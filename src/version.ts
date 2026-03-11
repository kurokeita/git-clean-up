import { execa } from "execa"
import packageJson from "../package.json"

export const APP_NAME = "git-clean-up"
export const PACKAGE_NAME = packageJson.name

export interface UpdateInfo {
	currentVersion: string
	latestVersion: string
}

function parseVersion(version: string): number[] {
	return version
		.replace(/^v/i, "")
		.split(".")
		.map((segment) => Number.parseInt(segment, 10))
		.map((segment) => (Number.isFinite(segment) ? segment : 0))
}

export function isNewerVersion(latestVersion: string, currentVersion: string) {
	const latest = parseVersion(latestVersion)
	const current = parseVersion(currentVersion)
	const maxLength = Math.max(latest.length, current.length)

	for (let index = 0; index < maxLength; index += 1) {
		const latestSegment = latest[index] ?? 0
		const currentSegment = current[index] ?? 0

		if (latestSegment === currentSegment) {
			continue
		}

		return latestSegment > currentSegment
	}

	return false
}

export function getVersion(): string {
	return packageJson.version
}

export async function checkForUpdates(
	fetchImpl: typeof fetch = fetch,
): Promise<UpdateInfo | null> {
	try {
		const response = await fetchImpl(
			`https://registry.npmjs.org/${PACKAGE_NAME}/latest`,
			{
				headers: {
					accept: "application/json",
				},
			},
		)

		if (!response.ok) {
			return null
		}

		const payload = (await response.json()) as { version?: string }
		const latestVersion = payload.version
		const currentVersion = getVersion()

		if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) {
			return null
		}

		return {
			currentVersion,
			latestVersion,
		}
	} catch {
		return null
	}
}

export async function installUpdate(): Promise<{ command: string }> {
	const command = `pnpm install -g ${PACKAGE_NAME}@latest`

	await execa("pnpm", ["install", "-g", `${PACKAGE_NAME}@latest`], {
		stdio: "ignore",
	})

	return { command }
}
