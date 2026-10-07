import { deriveRepoTags } from '../../shared/github-data.mjs'
import type { DerivedMetrics, GitHubRepoData, LegacyMockRepo, Repo } from '../types/repo.ts'

export function fromGitHub(github: GitHubRepoData, derived?: DerivedMetrics | number): Repo {
  const metrics = typeof derived === 'object' ? derived : undefined
  return {
    id: 'github-' + github.githubId, source: 'github', github,
    radar: { tags: deriveRepoTags(github), growth: { day: metrics?.growth.day?.delta ?? null, week: metrics?.growth.week?.delta ?? null, month: metrics?.growth.month?.delta ?? null }, hotScore: metrics?.hotScore ?? null, analysis: null, ...(metrics ? { metrics } : {}) },
  }
}

export function fromMock(mock: LegacyMockRepo): Repo {
  return {
    id: mock.id, source: 'mock',
    github: {
      githubId: null, owner: mock.owner, name: mock.name, fullName: mock.owner + '/' + mock.name,
      description: mock.description, htmlUrl: 'https://github.com/' + mock.owner + '/' + mock.name,
      homepage: null, language: mock.language, stars: mock.stars, forks: mock.forks, openIssues: null,
      topics: null, license: { key: null, name: mock.license, spdxId: null },
      createdAt: mock.createdAt, updatedAt: mock.updatedAt, pushedAt: null, archived: null, fork: null,
    },
    radar: {
      tags: mock.tags, growth: { day: mock.stars24h, week: mock.stars7d, month: mock.stars30d }, hotScore: mock.hotScore,
      analysis: {
        difficulty: mock.difficulty, soloDeveloperScore: mock.soloDeveloperScore, codexScore: mock.codexScore,
        overview: mock.overview, coreFeatures: mock.coreFeatures, techStack: mock.techStack,
        whyTrending: mock.whyTrending, whyInteresting: mock.whyInteresting,
        buildIdea: mock.buildIdea, buildSteps: mock.buildSteps, extensionIdeas: mock.extensionIdeas,
      },
    },
  }
}
