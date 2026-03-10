export const PROTECTED_BRANCHES = ["main", "master", "develop", "dev"]

/**
 * Checks if a branch name is in the protected list (case-insensitive).
 */
export function isProtectedBranch(branchName: string): boolean {
	return PROTECTED_BRANCHES.includes(branchName.toLowerCase())
}
