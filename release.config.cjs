/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
	branches: ["main"],
	repositoryUrl: "https://github.com/kurokeita/git-clean-up.git",
	plugins: [
		"@semantic-release/commit-analyzer",
		"@semantic-release/release-notes-generator",
		"@semantic-release/github",
		"@semantic-release/npm",
		[
			"@semantic-release/git",
			{
				assets: ["package.json"],
				message:
					// biome-ignore lint/suspicious/noTemplateCurlyInString: semantic-release renders these placeholders at release time
					"chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
			},
		],
	],
}
