import { describe, expect, test, vi } from 'vitest';

import type { GitHubControllerActorClient } from '../src/github_controller_actor_client.ts';
import { GitHubModel } from '../src/github_model.ts';
import type { Octokit } from '../src/types.ts';

function makeGithubModel(paginate: ReturnType<typeof vi.fn>) {
    const octokit = { paginate, rest: { teams: { listChildInOrg: vi.fn() } } } as unknown as Octokit;
    return new GitHubModel(octokit, {} as GitHubControllerActorClient);
}

describe('getChildTeams', () => {
    test('returns null when the parent team does not exist in the organization', async () => {
        const githubModel = makeGithubModel(
            vi.fn().mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 })),
        );

        await expect(githubModel.getChildTeams('apify-store', 'store-engineering')).resolves.toBeNull();
    });

    test('rethrows errors other than a missing parent team', async () => {
        const githubModel = makeGithubModel(
            vi.fn().mockRejectedValue(Object.assign(new Error('Resource not accessible'), { status: 403 })),
        );

        await expect(githubModel.getChildTeams('apify-store', 'store-engineering')).rejects.toThrow(
            'Resource not accessible',
        );
    });
});
