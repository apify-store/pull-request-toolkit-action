# Pull request toolkit

This action automates a couple of processes connected with the management of GitHub pull requests.

## What it does

- Assigns the pull request to its creator.
- Adds a `tested` label if the pull request changes any test files.
- Assigns the pull request to the project board of the team that the pull request creator belongs to.
- Assigns the pull request to the current sprint of that board if the team uses sprints.
- Warns when the pull request has more than 5 commits.
- Makes sure that:
  - all commits follow [Conventional Commits](https://www.conventionalcommits.org) (merge commits are skipped)
  - the pull request is either linked with an issue or labeled as `adhoc`
  - every linked issue that is not an `Epic` has an estimate on its project board (temporarily disabled), a type and a priority

The linking checks are retried every 15 seconds for 2 minutes so that the user can set them up after the pull request is created without this action failing.

Once a pull request is merged into the default branch, the action closes the issues referenced in its body with a closing keyword (`closes #123`, `fixes: #123`, `resolves [#123](https://github.com/...)`), including pull requests from bots, and from forks for issues in the same repository. Otherwise, the action skips pull requests that come from external forks or bots, that are closed, that do not target the repository's default branch, or whose creator is not a member of any team under `PARENT_TEAM_SLUGS` in [`src/consts.ts`](src/consts.ts). Teams listed in `SKIP_LINKING_AND_ESTIMATE_CHECKS_FOR_TEAMS` in [`src/consts.ts`](src/consts.ts) are exempt from the linking and estimate checks.

## Action input

| Name           | Description                              | Example        | Required |
|----------------|------------------------------------------|----------------|----------|
| `org-token`    | GitHub token with access to organization | `github-token` | yes      |

## How to enable for a repository

**!!! Do not call this action directly !!!**

Set the `pull_request_toolkit_required` custom repository property to `Yes` in the target repository settings.
The action will be automatically triggered for all pull requests on that repository through a repository ruleset.

## How to release new version

1. Create a PR. **IMPORTANT: Avoid using the `chore:` prefix, as it doesn't work with RELEASE-PLEASE. Use `feat:` or `fix:` instead.**
2. Merge PR into the main branch after approval. This triggers an automated workflow that generates a new PR for the release using the RELEASE-PLEASE action.
3. Navigate to the PR and merge it into the main branch. This will publish the release with an updated changelog.

## Future improvements

- move into a monorepo with `github-webhooks`, `apif`, `kanban-toolkit`, and maybe others
