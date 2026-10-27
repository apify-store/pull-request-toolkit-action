export const PARENT_TEAM_SLUGS: readonly string[] = ['product-engineering', 'store-engineering'];

export const LABELS = {
    ADHOC: 'adhoc',
    TESTED: 'tested',
} as const;

export const TEAM_LABEL_PREFIX = 't-';

export const TEAM_NAME_TO_LABEL: { [name: string]: string } = {
    Infrastructure: 't-infra',
};

// Project boards are found by the "<TEAM_NAME> Team Kanban" convention. A team whose board
// carries a different name needs an entry here, or its board is silently not found.
export const TEAM_NAME_TO_PROJECT_TITLE: { [name: string]: string } = {
    Web: 'Acquisition Team Kanban',
};
export const PROJECT_FIELD_NAMES = {
    ESTIMATE: 'Estimate',
    SPRINT: 'Sprint',
    STATUS: 'Status',
} as const;

export const ISSUE_FIELD_NAMES = {
    PRIORITY: 'Priority',
} as const;

// Epics are exempt from the estimate, type and priority checks of linked issues.
export const EPIC_ISSUE_TYPE = 'Epic';

export const STATUS_FIELD_VALUES = {
    NEW_ISSUES: 'New Issues',
    ICEBOX: 'Icebox',
    PRE_BACKLOG: 'Pre-Backlog',
    BACKLOG: 'Backlog',
    IN_PROGRESS: 'In Progress',
    PULL_REQUEST: 'Pull Request',
    CLOSED: 'Closed',
} as const;

export const KNOWN_BOT_USERS: readonly string[] = [
    'apify-service-account',
    'github-actions[bot]',
    'dependabot[bot]',
    'renovate[bot]',
    'copilot',
    'apify-deps[bot]',
];

// Excludes the team from correct linking and estimate checks.
export const SKIP_LINKING_AND_ESTIMATE_CHECKS_FOR_TEAMS: readonly string[] = ['Docs'];

// Error returned by the `addCloseIssueReferences` mutation when the issue has too many manually linked pull requests.
export const MANUAL_REFERENCE_LIMIT_ERROR_MESSAGE = 'Issue exceeds manual reference limit';

// The types of https://github.com/conventional-changelog/commitlint/tree/master/%40commitlint/config-conventional
export const CONVENTIONAL_COMMIT_REGEXP =
    /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([^)]*\))?!?: \S/;

// A warning is shown when the pull request has more commits than this.
export const MAX_COMMITS_WITHOUT_WARNING = 5;

export const LINKING_CHECK_RETRIES = 8;
export const LINKING_CHECK_DELAY_MILLIS = 15 * 1000;
