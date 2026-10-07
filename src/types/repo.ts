import type { ProjectEvaluation } from '../services/evaluation/evaluationTypes.ts'

export const categories = ['全部', 'AI / Agent', '效率工具', '学习工具', 'Computer Vision', '开发工具', 'App', '有趣项目', '值得复刻', '一个人能做'] as const
export const discoveryCategories = [...categories, '适合 Codex'] as const
export type Category = (typeof discoveryCategories)[number]
export type TimeRange = 'today' | 'week' | 'month'
export type Rating = 1 | 2 | 3 | 4 | 5

/** Provider-neutral model. Metrics and editorial judgments remain separate fields. */
export interface LegacyMockRepo {
  id: string
  owner: string
  name: string
  description: string
  language: string
  stars: number
  forks: number
  stars24h: number
  stars7d: number
  stars30d: number
  hotScore: number
  tags: string[]
  createdAt: string
  updatedAt: string
  difficulty: Rating
  soloDeveloperScore: Rating
  codexScore: Rating
  overview: string
  coreFeatures: string[]
  techStack: string[]
  license: string
  whyTrending: string
  whyInteresting: string
  buildIdea: string
  buildSteps: string[]
  extensionIdeas: string[]
}

export interface GitHubRepoData {
  githubId: number | null
  owner: string
  name: string
  fullName: string
  description: string | null
  htmlUrl: string
  homepage: string | null
  language: string | null
  stars: number | null
  forks: number | null
  openIssues: number | null
  topics: string[] | null
  license: { key: string | null; name: string | null; spdxId: string | null } | null
  createdAt: string | null
  updatedAt: string | null
  pushedAt: string | null
  archived: boolean | null
  fork: boolean | null
}

export interface RepoAnalysis {
  difficulty: Rating
  soloDeveloperScore: Rating
  codexScore: Rating
  overview: string
  coreFeatures: string[]
  techStack: string[]
  whyTrending: string
  whyInteresting: string
  buildIdea: string
  buildSteps: string[]
  extensionIdeas: string[]
}

export interface RepoRadarData {
  evaluation?: ProjectEvaluation
  tags: string[]
  growth: { day: number | null; week: number | null; month: number | null }
  hotScore: number | null
  analysis: RepoAnalysis | null
  metrics?: DerivedMetrics
}

export interface Repo {
  id: string
  source: 'github' | 'mock'
  github: GitHubRepoData
  radar: RepoRadarData
}

export interface SearchQuery {
  name: string
  q: string
  sort: 'stars' | 'updated'
  perPage: number
  returned: number
}

export interface GitHubDataset {
  version: 1
  generatedAt: string
  source: 'github'
  repoCount: number
  queries: SearchQuery[]
  repositories: GitHubRepoData[]
  metrics?: Record<string, DerivedMetrics>
}

export interface RepoCatalog {
  source: 'github' | 'mock'
  generatedAt: string | null
  repoCount: number
  repositories: Repo[]
  status: 'success' | 'fallback'
  fallbackReason: string | null
}

export interface Snapshot { capturedAt: string; stars: number }
export interface GrowthDetail { delta: number; rate: number | null; baselineCapturedAt: string; baselineStars: number; actualWindowHours: number }
export interface DerivedMetrics {
  growth: { day: GrowthDetail | null; week: GrowthDetail | null; month: GrowthDetail | null }
  hotScore: number | null
  hotComponents: { absolute24h: number; relative24h: number | null; absolute7d: number | null; activity: number | null } | null
  snapshots: Snapshot[]
}
export interface StarHistory { version: 1; updatedAt: string; retentionDays: 35; repositories: Record<string, { fullName: string; snapshots: Snapshot[] }> }

export type LoadStatus = 'loading' | 'success' | 'fallback' | 'error'
