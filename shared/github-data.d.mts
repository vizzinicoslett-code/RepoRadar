import type { GitHubDataset, GitHubRepoData } from '../src/types/repo.ts'
export function mapGitHubRepository(value: unknown): GitHubRepoData
export function deduplicateRepositories(repositories: GitHubRepoData[]): GitHubRepoData[]
export function validateGitHubDataset(value: unknown): GitHubDataset
export function deriveRepoTags(repo: GitHubRepoData): string[]
