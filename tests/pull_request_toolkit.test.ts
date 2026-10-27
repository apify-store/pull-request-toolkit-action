import { describe, expect, test, vi } from 'vitest';

import { LABELS } from '../src/consts.ts';
import type { GitHubModel } from '../src/github_model.ts';
import { PullRequestToolkit } from '../src/pull_request_toolkit.ts';
import type { Core } from '../src/types.ts';

const mockCore = {
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
} as unknown as Core;

const basePullRequest = { body: '', labels: [], base: { repo: { owner: { login: 'apify' }, name: 'apify-proxy' } } };
const adhocPullRequest = { ...basePullRequest, labels: [{ name: LABELS.ADHOC }] };

function makeGithubModel(overrides: Partial<GitHubModel> = {}): Partial<GitHubModel> {
    return {
        getPullRequest: vi.fn().mockResolvedValue(basePullRequest),
        getNativelyLinkedIssuesForPullRequest: vi.fn().mockResolvedValue([]),
        getProjectItemsForIssue: vi.fn().mockResolvedValue([]),
        // No "Estimate" key at all, which is what GitHub returns when the field was never set.
        getProjectItemFieldValues: vi.fn().mockResolvedValue({}),
        ...overrides,
    };
}

function makeToolkit(githubModel: Partial<GitHubModel>) {
    return new PullRequestToolkit(githubModel as GitHubModel, mockCore, 'apify', 'apify-proxy', 1652);
}

describe('getLinkingProblems', () => {
    function makeLinkedIssueGithubModel({
        type = { name: 'Task' } as { name: string } | null,
        priority = 'High' as string | null,
        estimate = 3 as number | null,
    } = {}) {
        return makeGithubModel({
            getNativelyLinkedIssuesForPullRequest: vi
                .fn()
                .mockResolvedValue([{ owner: 'apify', repo: 'apify-proxy', number: 1627 }]),
            getIssue: vi.fn().mockResolvedValue({ type }),
            getIssueFieldValues: vi.fn().mockResolvedValue(priority === null ? {} : { Priority: priority }),
            getProjectItemsForIssue: vi.fn().mockResolvedValue([{ id: 'issue-item' }]),
            // No "Estimate" key at all is what GitHub returns when the field was never set.
            getProjectItemFieldValues: vi
                .fn()
                .mockResolvedValue(
                    estimate === null ? {} : { Estimate: { id: 'field-1', dataType: 'NUMBER', value: estimate } },
                ),
        });
    }

    test('has no problems when the linked issue has an estimate, a type and a priority', async () => {
        await expect(makeToolkit(makeLinkedIssueGithubModel()).getLinkingProblems()).resolves.toEqual([]);
    });

    test('accepts an estimate of zero', async () => {
        const githubModel = makeLinkedIssueGithubModel({ estimate: 0 });

        await expect(makeToolkit(githubModel).getLinkingProblems()).resolves.toEqual([]);
    });

    test('lists everything the linked issue is missing', async () => {
        const githubModel = makeLinkedIssueGithubModel({ type: null, priority: null, estimate: null });

        // TODO: Put "an estimate" back once the estimate check is enabled again.
        await expect(makeToolkit(githubModel).getLinkingProblems()).resolves.toEqual([
            'Linked issue apify/apify-proxy#1627 does not have a type, a priority.',
        ]);
    });

    test('does not check linked epics', async () => {
        const githubModel = makeLinkedIssueGithubModel({
            type: { name: 'Epic' },
            priority: null,
            estimate: null,
        });

        await expect(makeToolkit(githubModel).getLinkingProblems()).resolves.toEqual([]);
    });

    test('does not check an adhoc pull request without linked issues', async () => {
        const githubModel = makeGithubModel({ getPullRequest: vi.fn().mockResolvedValue(adhocPullRequest) });

        await expect(makeToolkit(githubModel).getLinkingProblems()).resolves.toEqual([]);
    });

    test('fails when there are no linked issues and no adhoc label', async () => {
        await expect(makeToolkit(makeGithubModel()).getLinkingProblems()).resolves.toEqual([
            'Pull request is not linked to a GitHub issue, and is not marked as adhoc.',
        ]);
    });
});

describe('getCommitsSummary', () => {
    function makeCommit(message: string, parentCount = 1) {
        return { commit: { message }, parents: Array.from({ length: parentCount }, () => ({})) };
    }

    test('finds commits not following Conventional Commits, skipping merge commits', async () => {
        const githubModel = makeGithubModel({
            getPullRequestCommits: vi
                .fn()
                .mockResolvedValue([
                    makeCommit('feat(api): add endpoint\n\nCloses #1'),
                    makeCommit('fix!: drop support'),
                    makeCommit('Fix typo'),
                    makeCommit('feature: something'),
                    makeCommit("Merge branch 'main' into feat/x", 2),
                ]),
        });

        await expect(makeToolkit(githubModel).getCommitsSummary()).resolves.toEqual({
            commitCount: 5,
            nonConventionalCommitTitles: ['Fix typo', 'feature: something'],
        });
    });
});

describe('linkIssuesMentionedInPullRequestBody', () => {
    const partOfPullRequest = { ...basePullRequest, node_id: 'PR_1', body: 'Part of #100\nPart of #200' };

    function makeLinkingGithubModel(overrides: Partial<GitHubModel> = {}) {
        return makeGithubModel({
            getPullRequest: vi.fn().mockResolvedValue(partOfPullRequest),
            getIssue: vi
                .fn()
                .mockImplementation((_owner: string, _repo: string, number: number) =>
                    Promise.resolve({ node_id: `I_${number}` }),
                ),
            linkPullRequestToIssue: vi.fn().mockResolvedValue({}),
            ...overrides,
        });
    }

    test('links only issues in the pull request repository when asked to', async () => {
        const githubModel = makeLinkingGithubModel({
            getPullRequest: vi
                .fn()
                .mockResolvedValue({ ...partOfPullRequest, body: 'Part of #100\nPart of apify/apify-core#200' }),
        });

        await makeToolkit(githubModel).linkIssuesMentionedInPullRequestBody({ onlyInPullRequestRepository: true });

        expect(githubModel.linkPullRequestToIssue).toHaveBeenCalledExactlyOnceWith('I_100', 'PR_1');
    });

    test('does not manually link issues referenced with a closing keyword, GitHub links those natively', async () => {
        const githubModel = makeLinkingGithubModel({
            getPullRequest: vi.fn().mockResolvedValue({ ...partOfPullRequest, body: 'Closes #100\nPart of #200' }),
        });

        await makeToolkit(githubModel).linkIssuesMentionedInPullRequestBody();

        expect(githubModel.linkPullRequestToIssue).toHaveBeenCalledExactlyOnceWith('I_200', 'PR_1');
    });

    test('skips issues that are already linked', async () => {
        const githubModel = makeLinkingGithubModel({
            getNativelyLinkedIssuesForPullRequest: vi
                .fn()
                .mockResolvedValue([{ owner: 'apify', repo: 'apify-proxy', number: 100 }]),
        });

        await makeToolkit(githubModel).linkIssuesMentionedInPullRequestBody();

        expect(githubModel.linkPullRequestToIssue).toHaveBeenCalledTimes(1);
        expect(githubModel.linkPullRequestToIssue).toHaveBeenCalledWith('I_200', 'PR_1');
    });

    test('continues with a warning when an issue exceeds the manual reference limit', async () => {
        const githubModel = makeLinkingGithubModel({
            linkPullRequestToIssue: vi
                .fn()
                .mockRejectedValueOnce(
                    new Error(
                        'Request failed due to following response errors:\n - Issue exceeds manual reference limit',
                    ),
                )
                .mockResolvedValueOnce({}),
        });

        await expect(makeToolkit(githubModel).linkIssuesMentionedInPullRequestBody()).resolves.toBeUndefined();

        expect(githubModel.linkPullRequestToIssue).toHaveBeenCalledTimes(2);
        expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('apify/apify-proxy#100'));
    });

    test('rethrows other linking errors', async () => {
        const githubModel = makeLinkingGithubModel({
            linkPullRequestToIssue: vi.fn().mockRejectedValue(new Error('Something else')),
        });

        await expect(makeToolkit(githubModel).linkIssuesMentionedInPullRequestBody()).rejects.toThrow('Something else');
    });
});

describe('findUsersChildTeamName', () => {
    function makeTeamsGithubModel(
        childTeamsByParentSlug: Record<string, { slug: string; name: string }[] | null>,
        memberLoginsByTeamSlug: Record<string, string[]>,
    ) {
        return makeGithubModel({
            getChildTeams: vi
                .fn()
                .mockImplementation((_org: string, parentTeamSlug: string) =>
                    Promise.resolve(childTeamsByParentSlug[parentTeamSlug] ?? null),
                ),
            getTeamMembers: vi
                .fn()
                .mockImplementation((_org: string, teamSlug: string) =>
                    Promise.resolve((memberLoginsByTeamSlug[teamSlug] ?? []).map((login) => ({ login }))),
                ),
        });
    }

    test('finds the team in a store-engineering child team when product-engineering does not exist', async () => {
        const githubModel = makeTeamsGithubModel(
            { 'product-engineering': null, 'store-engineering': [{ slug: 'store', name: 'Store' }] },
            { store: ['alice'] },
        );

        await expect(makeToolkit(githubModel).findUsersChildTeamName('alice')).resolves.toBe('Store');
    });

    test('fails when none of the parent teams has any child teams', async () => {
        const githubModel = makeTeamsGithubModel({ 'product-engineering': null, 'store-engineering': [] }, {});

        await expect(makeToolkit(githubModel).findUsersChildTeamName('alice')).rejects.toThrow('No child teams found');
    });
});

describe('closeIssuesMentionedInPullRequestBody', () => {
    async function closedIssuesFor(body: string) {
        const githubModel = makeGithubModel({
            getPullRequest: vi.fn().mockResolvedValue({ ...basePullRequest, body }),
            getIssue: vi.fn().mockResolvedValue({}),
            closeIssueAsCompleted: vi.fn().mockResolvedValue(undefined),
        });
        await makeToolkit(githubModel).closeIssuesMentionedInPullRequestBody();
        return vi.mocked(githubModel.closeIssueAsCompleted!).mock.calls;
    }

    test.each([
        ['Closes #100', ['apify', 'apify-proxy', 100]],
        ['Closes: #100', ['apify', 'apify-proxy', 100]],
        ['Fixes: https://github.com/apify/apify-core/issues/100', ['apify', 'apify-core', 100]],
        ['Closes [#100](https://github.com/apify/apify-core/issues/100)', ['apify', 'apify-core', 100]],
        ['closes [apify-core#100](https://github.com/apify/apify-core/issues/100)', ['apify', 'apify-core', 100]],
        [
            'Resolves: [apify/apify-core#100](https://github.com/apify/apify-core/issues/100)',
            ['apify', 'apify-core', 100],
        ],
    ])('closes the issue referenced by "%s"', async (body, expected) => {
        expect(await closedIssuesFor(body)).toEqual([expected]);
    });

    test.each([
        'Part of #100',
        'Part of: #100',
        'Part of [#100](https://github.com/apify/apify-core/issues/100)',
        'Accepts `Closes: #100` now',
        '```\nCloses #100\n```',
        '~~~\nCloses #100\n~~~',
        '<!-- Closes #100 -->',
        'Unresolved: #100',
        'Prefixes #100',
    ])('does not close the issue referenced by "%s"', async (body) => {
        expect(await closedIssuesFor(body)).toEqual([]);
    });

    test('closes only issues in the pull request repository when asked to, without looking up the others', async () => {
        const githubModel = makeGithubModel({
            getPullRequest: vi
                .fn()
                .mockResolvedValue({ ...basePullRequest, body: 'Closes #100\nCloses apify/apify-core#200' }),
            getIssue: vi.fn().mockResolvedValue({}),
            closeIssueAsCompleted: vi.fn().mockResolvedValue(undefined),
        });

        await makeToolkit(githubModel).closeIssuesMentionedInPullRequestBody({ onlyInPullRequestRepository: true });

        expect(githubModel.closeIssueAsCompleted).toHaveBeenCalledExactlyOnceWith('apify', 'apify-proxy', 100);
        expect(githubModel.getIssue).toHaveBeenCalledExactlyOnceWith('apify', 'apify-proxy', 100);
    });

    test.each([404, 410])('skips references to issues that respond with %i and closes the rest', async (status) => {
        const githubModel = makeGithubModel({
            getPullRequest: vi.fn().mockResolvedValue({ ...basePullRequest, body: 'Closes #100\nCloses #200' }),
            getIssue: vi
                .fn()
                .mockImplementation((_owner: string, _repo: string, number: number) =>
                    number === 100
                        ? Promise.reject(Object.assign(new Error('Not Found'), { status }))
                        : Promise.resolve({}),
                ),
            closeIssueAsCompleted: vi.fn().mockResolvedValue(undefined),
        });

        await makeToolkit(githubModel).closeIssuesMentionedInPullRequestBody();

        expect(githubModel.closeIssueAsCompleted).toHaveBeenCalledExactlyOnceWith('apify', 'apify-proxy', 200);
        expect(mockCore.warning).toHaveBeenCalledWith(expect.stringContaining('apify/apify-proxy#100'));
    });
});

describe('isBodyEditedAfterMerge', () => {
    test.each([
        ['edited after the merge', '2026-10-09T10:05:00Z', true],
        ['edited before the merge', '2026-10-09T09:55:00Z', false],
        ['never edited', null, false],
    ])('detects a body %s', async (_, lastEditedAt, expected) => {
        const githubModel = makeGithubModel({
            getPullRequestBodyEditedAndMergedAt: vi
                .fn()
                .mockResolvedValue({ lastEditedAt, mergedAt: '2026-10-09T10:00:00Z' }),
        });

        expect(await makeToolkit(githubModel).isBodyEditedAfterMerge()).toBe(expected);
    });
});
