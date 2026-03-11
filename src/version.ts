import packageJson from "../package.json"

export const APP_NAME = "git-clean-up"

export function getVersion(): string {
	return packageJson.version
}
