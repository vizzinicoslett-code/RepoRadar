import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { mapGitHubRepository } from '../shared/github-data.mjs'
import { fromGitHub } from '../src/services/repoAdapters.ts'
import { createRepoSource } from '../src/services/repoSource.ts'
import { selectRepos, getGrowth, formatCount, licenseName, safeHomepage } from '../src/utils/repos.ts'

const fixture = JSON.parse(await readFile(new URL('./fixtures/github-search.json', import.meta.url), 'utf8'))
const generatedAt = '2026-10-05T08:00:00Z'
const data = { version: 1, source: 'github', generatedAt, repoCount: 3, queries: [], repositories: fixture.items.map(mapGitHubRepository) }
const repos = data.repositories.map(fromGitHub)

test('real repository adapters never fabricate growth, hot score or analysis', () => {
  for (const repo of repos) {
    assert.equal(repo.source, 'github')
    assert.deepEqual(repo.radar.growth, { day: null, week: null, month: null })
    assert.equal(repo.radar.hotScore, null)
    assert.equal(repo.radar.analysis, null)
    assert.equal(getGrowth(repo, 'today'), null)
  }
})

test('real search matches owner, name, description, language and topics, including null fields', () => {
  for (const query of ['radar-labs', 'vision-agent', 'workflows', 'python', 'llm']) assert.ok(selectRepos(repos, query, '全部', 'month', generatedAt).some((repo) => repo.github.githubId === 101))
  assert.equal(selectRepos(repos, 'education', '学习工具', 'month', generatedAt)[0]?.github.githubId, 102)
  assert.equal(selectRepos(repos, 'python', 'App', 'month', generatedAt).length, 0)
})

test('real periods filter activity windows relative to dataset time, then sort by stars', () => {
  assert.deepEqual(selectRepos(repos, '', '全部', 'today', generatedAt).map((repo) => repo.github.githubId), [101])
  assert.deepEqual(selectRepos(repos, '', '全部', 'week', generatedAt).map((repo) => repo.github.githubId), [102, 101])
  assert.deepEqual(selectRepos(repos, '', '全部', 'month', generatedAt).map((repo) => repo.github.githubId), [103, 102, 101])
  const missing = structuredClone(repos[0])
  missing.github.pushedAt = null
  missing.github.updatedAt = null
  missing.github.createdAt = null
  assert.equal(selectRepos([missing], '', '全部', 'month', generatedAt).length, 0)
})

test('static data source validates and maps the same-origin file', async () => {
  let requests = 0
  const fetcher: typeof fetch = async (url) => { requests++; assert.equal(url, '/RepoRadar/data/repos.json'); return new Response(JSON.stringify(data)) }
  const catalog = await createRepoSource({ dataUrl: '/RepoRadar/data/repos.json', fetcher }).list()
  assert.equal(catalog.status, 'success')
  assert.equal(catalog.source, 'github')
  assert.equal(catalog.repoCount, 3)
  assert.equal(catalog.generatedAt, generatedAt)
  assert.equal(catalog.repositories[0].id, 'github-101')
  assert.equal(requests, 1)
})

test('injected fetch is invoked without binding a class instance as its receiver', async () => {
  const fetcher: typeof fetch = async function (this: unknown) {
    assert.equal(this, undefined)
    return new Response(JSON.stringify(data))
  }
  assert.equal((await createRepoSource({ fetcher }).list()).source, 'github')
})

for (const [label, fetcher] of [
  ['404', async () => new Response('', { status: 404 })],
  ['corrupt JSON', async () => new Response('{broken')],
  ['invalid fields', async () => new Response(JSON.stringify({ ...data, repositories: [{ ...data.repositories[0], stars: -1 }], repoCount: 1 }))],
  ['empty dataset', async () => new Response(JSON.stringify({ ...data, repositories: [], repoCount: 0 }))],
  ['network failure', async () => { throw new Error('offline') }],
] as const) test(label + ' falls back to clearly identified mock data', async () => {
  const catalog = await createRepoSource({ fetcher }).list()
  assert.equal(catalog.status, 'fallback')
  assert.equal(catalog.source, 'mock')
  assert.equal(catalog.generatedAt, null)
  assert.equal(catalog.repoCount, 12)
  assert.ok(catalog.fallbackReason)
  assert.ok(catalog.repositories[0].radar.analysis)
})

test('explicit mock mode avoids fetching; aborted loads are not turned into fallback', async () => {
  let requests = 0
  const fetcher: typeof fetch = async () => { requests++; throw new Error('aborted') }
  assert.equal((await createRepoSource({ fetcher, forceMock: true }).list()).source, 'mock')
  assert.equal(requests, 0)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(createRepoSource({ fetcher }).list(controller.signal))
})

test('null formatting and unsafe homepages are handled without fake values or executable links', () => {
  assert.equal(formatCount(null), '—')
  assert.equal(formatCount(0), '0')
  assert.equal(licenseName(repos[0]), '未提供')
  assert.equal(licenseName(repos[1]), 'MIT')
  assert.equal(safeHomepage('javascript:alert(1)'), null)
  assert.equal(safeHomepage('https://user:password@example.com'), null)
  assert.equal(safeHomepage(null), null)
  assert.equal(safeHomepage('https://example.com/learning'), 'https://example.com/learning')
})

test('mixed real history puts known growth first and retains inactive measured repositories', () => {
  const a = structuredClone(repos[0]), b = structuredClone(repos[1]), c = structuredClone(repos[2])
  a.radar.growth = { day: 10, week: 100, month: 1000 }; a.radar.hotScore = 60
  b.radar.growth = { day: -12, week: 200, month: 900 }; b.radar.hotScore = 80
  b.github.pushedAt = '2026-07-01T00:00:00Z'
  c.github.pushedAt = generatedAt
  assert.deepEqual(selectRepos([c,a,b], '', '全部', 'today', generatedAt).map((r)=>r.id), [b.id,a.id,c.id])
  assert.deepEqual(selectRepos([c,a,b], '', '全部', 'week', generatedAt).map((r)=>r.id), [b.id,a.id,c.id])
  assert.deepEqual(selectRepos([c,a,b], '', '全部', 'month', generatedAt).map((r)=>r.id), [a.id,b.id,c.id])
})
