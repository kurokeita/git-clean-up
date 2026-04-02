/** Default branch names that should never be deleted. */
export const DEFAULT_PROTECTED_BRANCHES = ["main", "master", "develop", "dev"]

function toPatternRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
	const wildcardAware = escaped.replaceAll("*", ".*")
	return new RegExp(`^${wildcardAware}$`, "i")
}

/**
 * Tests whether a branch name matches a single pattern.
 * Supports `*` wildcards (e.g., `release/*`).
 * Matching is case-insensitive.
 */
export function matchesBranchPattern(
	branchName: string,
	pattern: string,
): boolean {
	return toPatternRegex(pattern).test(branchName)
}

/**
 * Tests whether a branch name matches any pattern in the list.
 */
export function matchesBranchPatterns(
	branchName: string,
	patterns: string[],
): boolean {
	return patterns.some((pattern) => matchesBranchPattern(branchName, pattern))
}

/**
 * Checks if a branch name is in the protected list (case-insensitive).
 */
export function isProtectedBranch(
	branchName: string,
	protectedBranches: string[] = DEFAULT_PROTECTED_BRANCHES,
): boolean {
	return matchesBranchPatterns(branchName, protectedBranches)
}
