import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, writeFile, mkdtemp, readdir, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { mapGitHubRepository, deduplicateRepositories, deriveRepoTags, validateGitHubDataset } from '../shared/github-data.mjs'
import { buildQueries, collectRepositories, refreshRepositories, writeDatasetAtomically } from '../scripts/fetch-github-repos.mjs'

const fixture = JSON.parse(await readFile(new URL('./fixtures/github-search.json', import.meta.url), 'utf8'))
const now = new Date('2026-10-05T08:00:00Z')
const quiet = { now, wait: async () => {}, log: () => {} }
function apiItem(id) {
  const name = 'demo-' + id
  return { ...fixture.items[0], id, name, full_name: 'radar-labs/' + name, html_url: 'https://github.com/radar-labs/' + name }
}
function largeDataset() {
  const repositories = Array.from({ length: 60 }, (_, index) => mapGitHubRepository(apiItem(index + 1)))
  return { version: 1, source: 'github', generatedAt: now.toISOString(), repoCount: repositories.length, queries: [], repositories }
}
function response(payload, remaining = '9', status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'x-ratelimit-limit': '10', 'x-ratelimit-remaining': remaining, 'x-ratelimit-reset': '1791187260', 'x-ratelimit-resource': 'search' } })
}
async function withOldFile(run) {
  const parent = resolve(tmpdir())
  const directory = await mkdtemp(join(parent, 'reporadar-tests-'))
  assert.ok(resolve(directory).startsWith(join(parent, 'reporadar-tests-')))
  const path = join(directory, 'repos.json')
  const old = JSON.stringify(largeDataset())
  await writeFile(path, old)
  try { await run(path, old, directory) }
  finally {
    for (const entry of await readdir(directory)) await rm(join(directory, entry), { force: true })
    await rmdir(directory)
  }
}

test('API mapping preserves native fields and discards unknown response fields', () => {
  const mapped = mapGitHubRepository({ ...fixture.items[0], unrelated: 'discard-me' })
  assert.equal(mapped.githubId, 101)
  assert.equal(mapped.fullName, 'radar-labs/vision-agent')
  assert.equal(mapped.stars, 1200)
  assert.equal(mapped.forks, 42)
  assert.equal(mapped.openIssues, 7)
  assert.equal(mapped.pushedAt, fixture.items[0].pushed_at)
  assert.equal('unrelated' in mapped, false)
  assert.equal('growth' in mapped, false)
})

test('null and missing optional API fields stay null; zero remains zero', () => {
  const mapped = mapGitHubRepository(fixture.items[1])
  assert.equal(mapped.description, null)
  assert.equal(mapped.language, null)
  assert.equal(mapped.forks, 0)
  assert.equal(mapped.license.spdxId, 'MIT')
  const minimal = mapGitHubRepository({ id: 99, owner: { login: 'radar-labs' }, name: 'minimal', full_name: 'radar-labs/minimal', html_url: 'https://github.com/radar-labs/minimal' })
  for (const key of ['description', 'language', 'license', 'topics', 'stars', 'forks', 'homepage', 'openIssues', 'createdAt', 'updatedAt', 'pushedAt', 'archived', 'fork']) assert.equal(minimal[key], null)
})

test('deduplication uses GitHub ID even when repository names change', () => {
  const original = mapGitHubRepository(fixture.items[0])
  assert.equal(deduplicateRepositories([original, { ...original, name: 'renamed' }, mapGitHubRepository(fixture.items[1])]).length, 2)
})

test('transparent classification handles topics, descriptions, names and nulls', () => {
  assert.deepEqual(deriveRepoTags(mapGitHubRepository(fixture.items[0])), ['AI / Agent', 'Computer Vision'])
  assert.deepEqual(deriveRepoTags(mapGitHubRepository(fixture.items[1])), ['学习工具', 'App'])
  assert.ok(deriveRepoTags(mapGitHubRepository(fixture.items[2])).includes('开发工具'))
  const tagged = deriveRepoTags(mapGitHubRepository({ ...fixture.items[0], description: null, language: null, topics: null, name: 'plain', full_name: 'radar-labs/plain', html_url: 'https://github.com/radar-labs/plain' }))
  assert.deepEqual(tagged, [])
  for (const item of fixture.items) assert.ok(!deriveRepoTags(mapGitHubRepository(item)).some((tag) => tag === '值得复刻' || tag === '一个人能做'))
})

test('dataset validation rejects damaged metadata, negative counts, missing identity and duplicates', () => {
  const good = largeDataset()
  assert.equal(validateGitHubDataset(good).repoCount, 60)
  for (const change of [
    (data) => { data.repositories = []; data.repoCount = 0 },
    (data) => { data.repositories[0].stars = -1 },
    (data) => { data.repositories[0].forks = 'bad' },
    (data) => { delete data.repositories[0].owner },
    (data) => { data.repositories[0].githubId = null },
    (data) => { data.repositories[0].htmlUrl = 'javascript:alert(1)' },
    (data) => { data.repositories[0].language = 22 },
    (data) => { data.repositories[0].topics = [false] },
    (data) => { data.repositories[0].createdAt = 'invalid' },
    (data) => { data.repositories[1] = data.repositories[0] },
    (data) => { data.repoCount = 999 },
    (data) => { data.version = 2 },
    (data) => { data.generatedAt = 'invalid' },
  ]) {
    const broken = structuredClone(good)
    change(broken)
    assert.throws(() => validateGitHubDataset(broken))
  }
})

test('six bounded sequential search queries produce a diverse capped pool, without extra repository calls', async () => {
  let requests = 0
  const logs = []
  const result = await collectRepositories({ ...quiet, token: undefined, log: (message) => logs.push(message), fetcher: async (url, options) => {
    assert.equal(url.hostname, 'api.github.com')
    assert.equal(url.pathname, '/search/repositories')
    assert.equal(url.searchParams.get('per_page'), '20')
    assert.equal(options.headers.Accept, 'application/vnd.github+json')
    assert.equal(options.headers['X-GitHub-Api-Version'], '2022-11-28')
    const offset = requests++ * 20
    return response({ incomplete_results: false, items: Array.from({ length: 20 }, (_, i) => apiItem(offset + i + 1)) })
  } })
  assert.equal(requests, 6)
  assert.equal(result.dataset.repoCount, 100)
  assert.deepEqual(result.dataset.repositories.slice(0, 6).map((repo) => repo.githubId), [1, 21, 41, 61, 81, 101])
  assert.equal(result.lastRateLimit.resource, 'search')
  assert.ok(logs.some((line) => line.includes('Rate limit remaining: 9')))
  assert.equal(buildQueries(now).length, 6)
  assert.ok(buildQueries(now)[0].q.includes('created:>=2026-09-05'))
})

for (const status of [403, 429]) test('HTTP ' + status + ' stops without retry and preserves the old JSON', async () => {
  await withOldFile(async (path, old) => {
    let requests = 0
    await assert.rejects(refreshRepositories({ ...quiet, outputPath: path, fetcher: async () => {
      requests++
      return new Response('{}', { status, headers: { 'retry-after': '120', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791187260' } })
    } }), /Retry after: 120/)
    assert.equal(requests, 1)
    assert.equal(await readFile(path, 'utf8'), old)
  })
})

test('low remaining allowance stops before another query', async () => {
  let requests = 0
  await assert.rejects(collectRepositories({ ...quiet, fetcher: async () => {
    requests++
    return response({ incomplete_results: false, items: fixture.items }, '1')
  } }), /remaining is too low/)
  assert.equal(requests, 1)
})

for (const [label, fetcher] of [
  ['network failure', async () => { throw new Error('offline') }],
  ['invalid JSON', async () => new Response('{invalid')],
  ['incomplete search', async () => response({ items: fixture.items, incomplete_results: true })],
  ['damaged fields', async () => response({ items: [{ ...fixture.items[0], stargazers_count: -1 }], incomplete_results: false })],
  ['empty pool', async () => response({ items: [], incomplete_results: false })],
]) test(label + ' cannot overwrite the last valid dataset', async () => {
  await withOldFile(async (path, old) => {
    await assert.rejects(refreshRepositories({ ...quiet, outputPath: path, fetcher }))
    assert.equal(await readFile(path, 'utf8'), old)
  })
})

test('a successful atomic write replaces the old file without leaving temporary files', async () => {
  await withOldFile(async (path, old, directory) => {
    const data = largeDataset()
    data.repositories[0].stars = 9876
    await writeDatasetAtomically(data, path)
    assert.notEqual(await readFile(path, 'utf8'), old)
    assert.equal(validateGitHubDataset(JSON.parse(await readFile(path, 'utf8'))).repositories[0].stars, 9876)
    assert.deepEqual(await readdir(directory), ['repos.json'])
    await assert.rejects(writeDatasetAtomically({ ...data, repositories: [], repoCount: 0 }, path))
    assert.equal(JSON.parse(await readFile(path, 'utf8')).repositories[0].stars, 9876)
  })
})
