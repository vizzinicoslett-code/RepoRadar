import assert from 'node:assert/strict'
import test from 'node:test'
import { mockRepos } from '../src/data/mockRepos.ts'
import { categories } from '../src/types/repo.ts'
import { getGrowth, selectRepos, githubUrl, formatCount } from '../src/utils/repos.ts'
import type { TimeRange } from '../src/types/repo.ts'
import { fromMock } from '../src/services/repoAdapters.ts'

const repos = mockRepos.map(fromMock)

test('demo catalog has unique IDs, valid metrics and complete detail content', () => {
  assert.ok(mockRepos.length >= 10)
  assert.equal(new Set(mockRepos.map((repo) => repo.id)).size, mockRepos.length)
  for (const repo of mockRepos) {
    assert.ok(repo.hotScore >= 0 && repo.hotScore <= 100)
    assert.ok(repo.stars24h <= repo.stars7d && repo.stars7d <= repo.stars30d)
    for (const rating of [repo.difficulty, repo.soloDeveloperScore, repo.codexScore]) assert.ok(rating >= 1 && rating <= 5)
    assert.ok(repo.overview && repo.whyTrending && repo.whyInteresting && repo.buildIdea && repo.license)
    assert.ok(repo.coreFeatures.length && repo.techStack.length && repo.buildSteps.length && repo.extensionIdeas.length)
    assert.ok(!Number.isNaN(Date.parse(repo.createdAt)) && !Number.isNaN(Date.parse(repo.updatedAt)))
  }
})

test('every requested category has matching demos', () => {
  for (const category of categories) assert.ok(selectRepos(repos, '', category, 'today').length > 0, category)
})

test('search matches owner, name, language and tags without case or whitespace sensitivity', () => {
  assert.equal(selectRepos(repos, '  BROWSER-USE   python ', '全部', 'today')[0]?.id, 'browser-use')
  assert.equal(selectRepos(repos, 'continuedev', '全部', 'today')[0]?.id, 'continue')
  assert.ok(selectRepos(repos, '值得复刻', '全部', 'today').length > 0)
  assert.equal(selectRepos(repos, '不存在的关键词-xyz', '全部', 'today').length, 0)
})

test('search and category filters intersect', () => {
  assert.deepEqual(selectRepos(repos, 'python', '一个人能做', 'today').map((repo) => repo.id), ['browser-use'])
  assert.deepEqual(selectRepos(repos, 'python', 'App', 'today').map((repo) => repo.id), ['open-webui'])
  assert.equal(selectRepos(repos, 'python', '效率工具', 'today').some((repo) => repo.id === 'browser-use'), false)
})

test('periods reorder demos by growth without mutating the original catalog', () => {
  const before = mockRepos.map((repo) => repo.id)
  const expected = { today: 'browser-use', week: 'open-webui', month: 'ollama' }
  for (const range of ['today', 'week', 'month'] as TimeRange[]) {
    const sorted = selectRepos(repos, '', '全部', range)
    assert.equal(sorted[0].id, expected[range])
    for (let i = 1; i < sorted.length; i++) assert.ok(getGrowth(sorted[i - 1], range) >= getGrowth(sorted[i], range))
  }
  assert.deepEqual(mockRepos.map((repo) => repo.id), before)
})

test('counts and repository links are formatted consistently', () => {
  assert.equal(formatCount(52400), '52.4k')
  assert.equal(formatCount(1000), '1k')
  assert.equal(formatCount(284), '284')
  assert.equal(githubUrl(repos[0]), 'https://github.com/browser-use/browser-use')
})
