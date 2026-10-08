import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import type { Repo } from '../src/types/repo.ts'
import type { ProjectEvaluation } from '../src/services/evaluation/evaluationTypes.ts'
import { buildChatGptResearchPrompt } from '../src/services/share/chatGptPrompt.ts'
import { copyChatGptPrompt } from '../src/services/share/clipboard.ts'

const fixture: { repo: Repo; evaluation: Partial<ProjectEvaluation> } = JSON.parse(readFileSync(new URL('./fixtures/chatgpt-repo.json', import.meta.url), 'utf8'))
const fresh = () => structuredClone(fixture)

test('complete research prompt matches full fixed text, contains the correct GitHub URL and leaves inputs unchanged', () => {
  const { repo, evaluation } = fresh(), before = structuredClone({ repo, evaluation })
  const prompt = buildChatGptResearchPrompt(repo, evaluation)
  assert.equal(prompt + '\n', readFileSync(new URL('./fixtures/chatgpt-research-prompt.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n'))
  assert.ok(prompt.includes('https://github.com/example/tiny-tool'))
  assert.ok(prompt.includes('Stars：12,345') && prompt.includes('Forks：321'))
  assert.ok(prompt.includes('Build Score：94/100') && prompt.includes('Codex 适合度：98/100'))
  assert.deepEqual({ repo, evaluation }, before)
})
test('missing description uses an honest fallback instead of a translated or fabricated description', () => {
  const { repo, evaluation } = fresh(); repo.github.description = null
  assert.ok(buildChatGptResearchPrompt(repo, evaluation).includes('项目简介：\nGitHub 暂未提供简介'))
})
test('missing or empty Topics, language and License have readable fallbacks', () => {
  const { repo, evaluation } = fresh(); repo.github.topics = null; repo.github.language = null; repo.github.license = null
  const prompt = buildChatGptResearchPrompt(repo, evaluation)
  assert.ok(prompt.includes('Topics：\n暂无') && prompt.includes('主要语言：\n未标注') && prompt.includes('License：\n暂未提供'))
  repo.github.topics = []; assert.ok(buildChatGptResearchPrompt(repo, evaluation).includes('Topics：\n暂无'))
})
test('missing week/month growth and null Hot stay accumulating rather than being shown as zero', () => {
  const { repo, evaluation } = fresh(); repo.radar.growth.week = null; repo.radar.growth.month = null; repo.radar.hotScore = null
  const prompt = buildChatGptResearchPrompt(repo, evaluation)
  for (const label of ['7d Star 增长', '30d Star 增长', 'Hot Score']) assert.ok(prompt.includes(label + '：数据积累中'))
})
test('partially missing Evaluation preserves supplied fields and marks the others unassessed', () => {
  const { repo } = fresh()
  const prompt = buildChatGptResearchPrompt(repo, { researchScore: 88, signals: ['已提供信号'] })
  assert.ok(prompt.includes('值得研究：88/100') && prompt.includes('值得复刻：未评估') && prompt.includes('Build Score：未评估'))
  assert.ok(prompt.includes('已提供信号') && prompt.includes('暂未提供注意事项'))
  assert.ok(buildChatGptResearchPrompt(repo, null).includes('暂未提供有利信号'))
})
test('positive growth keeps the plus sign and uses approximate 24h with the existing actual window', () => {
  const { repo, evaluation } = fresh(), prompt = buildChatGptResearchPrompt(repo, evaluation)
  assert.ok(prompt.includes('约24h Star 增长：+4,303\n实际统计窗口：28.9 小时'))
  assert.ok(!prompt.includes('严格24小时'))
  delete repo.radar.metrics
  assert.ok(!buildChatGptResearchPrompt(repo, evaluation).includes('实际统计窗口'))
})
test('negative and zero growth remain real values rather than positive growth or missing history', () => {
  const { repo, evaluation } = fresh(); repo.radar.growth.day = -25; repo.radar.growth.week = 0
  const prompt = buildChatGptResearchPrompt(repo, evaluation)
  assert.ok(prompt.includes('约24h Star 增长：-25') && prompt.includes('7d Star 增长：0'))
})
test('missing and non-finite numeric fields never produce null, undefined or NaN text', () => {
  const { repo } = fresh(); repo.github.stars = null; repo.github.forks = NaN; repo.radar.hotScore = NaN
  repo.radar.growth = { day: null, week: NaN, month: Infinity }
  const prompt = buildChatGptResearchPrompt(repo, { researchScore: NaN, buildScore: Infinity })
  assert.ok(!/undefined|null|NaN|Infinity|\[object Object\]/.test(prompt))
  assert.ok(!prompt.includes('实际统计窗口'))
})
test('signals and warnings each keep only five nonempty entries', () => {
  const { repo } = fresh(), signals = [' ', ...Array.from({ length: 8 }, (_, i) => 'signal-' + i)], warnings = ['', ...Array.from({ length: 8 }, (_, i) => 'warning-' + i)]
  const prompt = buildChatGptResearchPrompt(repo, { signals, warnings })
  assert.equal((prompt.match(/- signal-/g) ?? []).length, 5); assert.equal((prompt.match(/- warning-/g) ?? []).length, 5)
  assert.ok(!prompt.includes('signal-5') && !prompt.includes('warning-5'))
})
test('uses existing Evaluation by default, labels Mock honestly and asks for evidence instead of trusting scores', () => {
  const { repo, evaluation } = fresh(); repo.radar.evaluation = evaluation as ProjectEvaluation; repo.source = 'mock'
  const prompt = buildChatGptResearchPrompt(repo)
  assert.ok(prompt.includes('Build Score：94/100') && prompt.includes('当前项目来自 Mock'))
  for (const required of ['请访问并检查', '不要猜', '3～5 个核心功能', '第一阶段开发提示词', '不要因为 RepoRadar 的评分高', '资料来源与链接']) assert.ok(prompt.includes(required))
})
test('clipboard success writes the exact complete prompt once', async () => {
  const prompt = buildChatGptResearchPrompt(fixture.repo, fixture.evaluation), writes: string[] = []
  assert.equal(await copyChatGptPrompt(prompt, { writeText: async (value) => { writes.push(value) } }), 'copied')
  assert.deepEqual(writes, [prompt])
})
test('clipboard rejection returns fallback without losing or changing the generated prompt', async () => {
  const prompt = buildChatGptResearchPrompt(fixture.repo, fixture.evaluation); let attempted = ''
  assert.equal(await copyChatGptPrompt(prompt, { writeText: async (value) => { attempted = value; throw new Error('Denied') } }), 'fallback')
  assert.equal(attempted, prompt)
})
test('unavailable Clipboard API and a synchronously throwing writer both use fallback', async () => {
  assert.equal(await copyChatGptPrompt('完整文本', null), 'fallback')
  assert.equal(await copyChatGptPrompt('完整文本', { writeText: () => { throw new Error('Blocked') } }), 'fallback')
})
