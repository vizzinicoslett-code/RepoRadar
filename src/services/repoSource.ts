import { mockRepos } from '../data/mockRepos.ts'
import { validateGitHubDataset } from '../../shared/github-data.mjs'
import { fromGitHub, fromMock } from './repoAdapters.ts'
import type { RepoCatalog } from '../types/repo.ts'

export interface RepoSource {
  list(signal?: AbortSignal): Promise<RepoCatalog>
}

export class MockRepoSource implements RepoSource {
  async list(): Promise<RepoCatalog> {
    return { source: 'mock', generatedAt: null, repoCount: mockRepos.length, repositories: mockRepos.map(fromMock), status: 'success', fallbackReason: null }
  }
}

export class GithubStaticRepoSource implements RepoSource {
  private dataUrl: string
  private fetcher: typeof fetch
  constructor(dataUrl: string, fetcher: typeof fetch = fetch) { this.dataUrl = dataUrl; this.fetcher = fetcher }

  async list(signal?: AbortSignal): Promise<RepoCatalog> {
    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000)
    // Call fetch as a standalone function: Window.fetch rejects a class instance as its receiver.
    const fetcher = this.fetcher
    const response = await fetcher(this.dataUrl, { signal: requestSignal, cache: 'no-cache', credentials: 'omit', redirect: 'error' })
    if (!response.ok) throw new Error('静态数据读取失败（HTTP ' + response.status + '）')
    const data = validateGitHubDataset(await response.json())
    return { source: 'github', generatedAt: data.generatedAt, repoCount: data.repoCount, repositories: data.repositories.map((repo) => fromGitHub(repo, data.metrics?.[String(repo.githubId)])), status: 'success', fallbackReason: null }
  }
}

export function createRepoSource({ dataUrl = './data/repos.json', fetcher = fetch, forceMock = false }: { dataUrl?: string; fetcher?: typeof fetch; forceMock?: boolean } = {}): RepoSource {
  const mock = new MockRepoSource()
  const github = new GithubStaticRepoSource(dataUrl, fetcher)
  return {
    async list(signal) {
      if (forceMock) return mock.list()
      try { return await github.list(signal) }
      catch (error) {
        if (signal?.aborted) throw error
        const fallback = await mock.list()
        return { ...fallback, status: 'fallback', fallbackReason: '静态 GitHub 数据暂不可用，当前显示演示数据。' }
      }
    },
  }
}

export const repoSource = createRepoSource({
  dataUrl: (import.meta.env?.BASE_URL ?? './') + 'data/repos.json',
  forceMock: import.meta.env?.VITE_REPO_SOURCE === 'mock',
})
