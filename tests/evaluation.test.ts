import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fromGitHub } from '../src/services/repoAdapters.ts'
import { evaluateRepo, selectBuildRepos, matchesDevelopmentFilter } from '../src/services/evaluation/evaluateRepo.ts'
import { evaluationConfig } from '../src/services/evaluation/evaluationRules.ts'
import { getIdeaTemplate } from '../src/services/evaluation/ideaTemplates.ts'
import { deriveRepoTags } from '../shared/github-data.mjs'
import { selectRepos } from '../src/utils/repos.ts'
import type { Repo } from '../src/types/repo.ts'
import type { ScoreKey } from '../src/services/evaluation/evaluationTypes.ts'

const now = '2026-10-07T08:00:00Z'
interface Fixture { id: number; name: string; description: string; language: string; topics: string[]; hot: number; day: number; week: number | null }
const fixtures: Fixture[] = JSON.parse(readFileSync(new URL('./fixtures/evaluation.json', import.meta.url), 'utf8'))
const repos: Repo[] = fixtures.map((fixture) => {
  const repo = fromGitHub({ githubId: fixture.id, owner: 'fixture', name: fixture.name, fullName: 'fixture/' + fixture.name, description: fixture.description, language: fixture.language, topics: fixture.topics, htmlUrl: 'https://github.com/fixture/' + fixture.name, homepage: 'https://example.com', stars: 100, forks: 5, openIssues: 1, license: { key: 'mit', spdxId: 'MIT', name: 'MIT' }, createdAt: now, updatedAt: now, pushedAt: now, archived: false, fork: false })
  repo.radar.hotScore = fixture.hot
  repo.radar.growth = { day: fixture.day, week: fixture.week, month: null }
  return repo
})
const keys: ScoreKey[] = ['researchScore', 'useScore', 'remakeScore', 'soloScore', 'codexScore', 'complexityScore', 'buildScore']

test('five evaluation fixtures have bounded explained scores without changing source metadata or Hot', () => {
  for (const repo of repos) {
    const before = structuredClone(repo), evaluation = evaluateRepo(repo, now)
    for (const key of keys) { assert.ok(Number.isInteger(evaluation[key]) && evaluation[key] >= 0 && evaluation[key] <= 100); assert.ok(evaluation.explanations[key].length > 20) }
    assert.ok(evaluation.signals.length && evaluation.recommendedActions.length)
    assert.deepEqual(repo, before)
    assert.deepEqual(evaluateRepo(repo, now), evaluation)
  }
})
test('huge underlying project can have high Research and Hot but low Build; a small tool ranks ahead', () => {
  const kernel = evaluateRepo(repos[0], now), web = evaluateRepo(repos[1], now)
  assert.ok(kernel.researchScore >= 90 && kernel.remakeScore < 35 && kernel.soloScore < 30 && kernel.complexityScore >= 90 && kernel.buildScore < 35)
  assert.ok(web.remakeScore >= 90 && web.soloScore >= 90 && web.codexScore >= 90 && web.buildScore > 85)
  assert.equal(selectBuildRepos([repos[0], repos[1]], '', '全部', now)[0].id, repos[1].id)
  assert.equal(selectRepos([repos[0], repos[1]], '', '全部', 'today', now)[0].id, repos[0].id)
})
test('tutorials keep research value with lower direct software Use and a distinct content V1', () => {
  const evaluation = evaluateRepo(repos[2], now)
  assert.equal(evaluation.kind, 'content'); assert.ok(evaluation.researchScore >= 80 && evaluation.useScore < 40)
  assert.ok(evaluation.warnings.some((warning) => warning.includes('内容或模板')))
  assert.notDeepEqual(getIdeaTemplate(evaluation.kind).features, getIdeaTemplate('web').features)
})
test('Computer Vision with only the word AI stays CV, recommends offline OpenCV, and explicit agents still classify', () => {
  const evaluation = evaluateRepo(repos[3], now)
  assert.equal(evaluation.kind, 'cv')
  assert.ok(repos[3].radar.tags.includes('Computer Vision')); assert.ok(!repos[3].radar.tags.includes('AI / Agent'))
  assert.ok(getIdeaTemplate(evaluation.kind).techStack.includes('OpenCV'))
  assert.ok(getIdeaTemplate(evaluation.kind).excludedFeatures.includes('自训练模型'))
  assert.ok(deriveRepoTags({ ...repos[3].github, description: 'A browser agent with computer vision' }).includes('AI / Agent'))
})
test('large Agent gets broad scope penalties but still offers a feasible single task plan', () => {
  const large = evaluateRepo(repos[4], now), small = evaluateRepo({ ...repos[4], github: { ...repos[4].github, name: 'agent-tool', description: 'A single task agent', topics: ['agent'] } }, now)
  assert.equal(large.kind, 'agent'); assert.ok(large.complexityScore >= 70 && large.soloScore < small.soloScore)
  assert.ok(large.matchedRules.includes('broad-scope'))
  const template = getIdeaTemplate(large.kind)
  assert.ok(template.complexity < large.complexityScore && template.scope.includes('只解决一个任务') && template.excludedFeatures.includes('Multi-Agent'))
})
test('Research omits missing history and renormalizes available weights; negative growth contributes zero', () => {
  const repo = structuredClone(repos[1]); repo.radar.growth = { day: null, week: null, month: null }; repo.radar.hotScore = null
  const evaluation = evaluateRepo(repo, now)
  assert.equal(evaluation.researchScore, 100)
  repo.radar.growth.day = -10
  assert.equal(evaluateRepo(repo, now).researchScore, 50)
  assert.equal(evaluateRepo(repo, now).researchComponents.day, 0)
  assert.equal(evaluationConfig.researchWeights.week, .15)
})
test('Stars never raise suitability or inflate a skills collection Build', () => {
  const repo = structuredClone(repos[1]); repo.github.name = 'skills'; repo.github.description = 'Skills for Real Engineers'; repo.github.language = 'Shell'; repo.github.topics = []
  const before = evaluateRepo(repo, now); repo.github.stars = 10000000
  assert.deepEqual(evaluateRepo(repo, now), before)
  assert.equal(before.kind, 'skills'); assert.ok(before.remakeScore < 75 && before.buildScore < 85)
})
test('C++ is a weak signal and does not disqualify a small CLI', () => {
  const repo = { ...repos[1], github: { ...repos[1].github, name: 'small-cli', description: 'A command-line file tool', topics: ['cli'], language: 'C++' } }
  const evaluation = evaluateRepo(repo, now)
  assert.ok(evaluation.soloScore >= 85 && evaluation.codexScore >= 85 && evaluation.buildScore >= 85)
  assert.equal(evaluation.complexityScore, 33)
})
test('development thresholds are inclusive, search composes with filters, ties use identity without mutation', () => {
  const evaluation = evaluateRepo(repos[1], now)
  assert.ok(matchesDevelopmentFilter({ ...evaluation, remakeScore: 75 }, '值得复刻'))
  assert.ok(!matchesDevelopmentFilter({ ...evaluation, soloScore: 74 }, '一个人能做'))
  assert.ok(matchesDevelopmentFilter({ ...evaluation, codexScore: 80 }, '适合 Codex'))
  assert.deepEqual(selectBuildRepos(repos, 'web-tool', '适合 Codex', now).map((repo) => repo.id), [repos[1].id])
  const before = repos.map((repo) => repo.id)
  assert.equal(selectBuildRepos([repos[1], { ...repos[1], id: 'aaa' }], '', '全部', now)[0].id, 'aaa')
  assert.deepEqual(repos.map((repo) => repo.id), before)
})
test('unknown metadata, archived projects and future push timestamps explain limitations and remain finite', () => {
  const repo = structuredClone(repos[1]); Object.assign(repo.github, { name: 'plain', description: null, topics: null, language: null, homepage: null, license: null, pushedAt: null })
  repo.radar.growth = { day: null, week: null, month: null }; repo.radar.hotScore = null
  const evaluation = evaluateRepo(repo, now)
  assert.equal(evaluation.kind, 'unknown'); assert.equal(evaluation.researchScore, 0)
  repo.github.pushedAt = '2027-01-01T00:00:00Z'
  assert.equal(evaluateRepo(repo, now).researchComponents.activity, null)
  repo.github.archived = true
  assert.equal(evaluateRepo(repo, now).researchComponents.activity, 0)
  assert.ok(evaluateRepo(repo, now).warnings.some((warning) => warning.includes('归档')))
})
