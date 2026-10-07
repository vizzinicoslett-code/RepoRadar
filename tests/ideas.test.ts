import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { IdeaStore, IDEAS_KEY } from '../src/services/ideas/ideaStorage.ts'
import { generateCodexPrompt, dataSavingSuggestion } from '../src/services/ideas/promptGenerator.ts'
import { createIdeaDraft } from '../src/services/ideas/ideaGenerator.ts'
import { evaluateRepo } from '../src/services/evaluation/evaluateRepo.ts'
import { getIdeaTemplate } from '../src/services/evaluation/ideaTemplates.ts'
import { fromGitHub } from '../src/services/repoAdapters.ts'
import type { IdeaDraft } from '../src/services/ideas/ideaTypes.ts'
import type { GitHubDataset } from '../src/types/repo.ts'

const draft: IdeaDraft = { sourceRepoId: 'github-123', sourceFullName: 'example/source', title: 'StudentSetup', targetUser: '大学生 Windows 用户', problem: '新电脑软件与开发环境配置难以核对。', features: ['软件清单', '手动记录安装状态', '导出配置清单'], excludedFeatures: ['登录', '云同步', '自动执行安装命令'], techStack: ['React', 'TypeScript', 'Vite', 'localStorage'], notes: '先做可核对的清单工具。', status: '准备做' }
const memory = () => { const values = new Map<string, string>(); return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } } }
const date = '2026-10-07T08:00:00.000Z'

test('create, update, refresh and multiple ideas persist with identities and timestamps', () => {
  const storage = memory(); let serial = 0, clock = date
  const store = new IdeaStore(storage, () => clock, () => 'idea-' + ++serial)
  const first = store.save(draft), second = store.save({ ...draft, title: 'Another' })
  clock = '2026-10-07T09:00:00.000Z'
  const updated = store.save({ ...first, title: 'Edited', status: '正在做' }, first.id)
  assert.equal(updated.createdAt, date); assert.equal(updated.updatedAt, clock)
  const refreshed = new IdeaStore(storage)
  assert.equal(refreshed.getSnapshot().ideas.length, 2)
  assert.equal(refreshed.getSnapshot().ideas.find((idea) => idea.id === first.id)?.title, 'Edited')
  refreshed.delete(second.id)
  assert.equal(new IdeaStore(storage).getSnapshot().ideas.length, 1)
  assert.ok(!storage.values.get(IDEAS_KEY)?.includes('Another'))
})
test('a saved idea remains complete when the source repo disappears and prompt never needs a network lookup', () => {
  const storage = memory(), store = new IdeaStore(storage, () => date, () => 'idea-one')
  const saved = store.save(draft)
  const reloaded = new IdeaStore(storage).getSnapshot().ideas[0]
  assert.deepEqual(reloaded, saved); assert.ok(generateCodexPrompt(reloaded).includes('example/source'))
})
test('corrupted JSON, unsupported versions, malformed entries and duplicate identities recover without a blank state', () => {
  const storage = memory(); storage.setItem(IDEAS_KEY, '{broken')
  const store = new IdeaStore(storage, () => date, () => 'idea-safe')
  assert.ok(store.getSnapshot().warning); assert.equal(store.getSnapshot().ideas.length, 0)
  const valid = store.save(draft)
  storage.setItem(IDEAS_KEY, JSON.stringify({ version: 1, ideas: [valid, { id: 'bad' }, valid] }))
  store.refresh(); assert.equal(store.getSnapshot().ideas.length, 1); assert.ok(store.getSnapshot().warning)
  storage.setItem(IDEAS_KEY, JSON.stringify({ version: 2, ideas: [valid] })); store.refresh()
  assert.ok(store.getSnapshot().warning)
})
test('disabled or full storage keeps in-memory edits with an explicit persistence warning', () => {
  const unavailable = new IdeaStore(null, () => date, () => 'idea-memory')
  unavailable.save(draft)
  assert.equal(unavailable.getSnapshot().persistent, false); assert.equal(unavailable.getSnapshot().ideas.length, 1)
  const full = new IdeaStore({ getItem: () => null, setItem: () => { throw new Error('Quota') } }, () => date, () => 'idea-full')
  full.save(draft); assert.equal(full.getSnapshot().persistent, false); assert.ok(full.getSnapshot().warning?.includes('刷新会丢失'))
})
test('invalid forms and stale update identities cannot overwrite unrelated ideas', () => {
  const storage = memory(), store = new IdeaStore(storage, () => date, () => 'idea-safe')
  const existing = store.save(draft), before = storage.values.get(IDEAS_KEY)
  for (const bad of [{ ...draft, title: '' }, { ...draft, features: [] }, { ...draft, techStack: [] }, { ...draft, sourceFullName: 'javascript:bad' }, { ...draft, notes: 'x'.repeat(8001) }]) assert.throws(() => store.save(bad))
  assert.throws(() => store.save(draft, 'deleted'))
  assert.equal(storage.values.get(IDEAS_KEY), before)
  store.delete(existing.id); assert.equal(store.getSnapshot().ideas.length, 0)
})
test('stored records are whitelisted, foreign fields never survive reload, and empty exclusions are supported', () => {
  const storage = memory(), store = new IdeaStore(storage, () => date, () => 'idea-safe')
  const idea = store.save({ ...draft, excludedFeatures: [] })
  storage.setItem(IDEAS_KEY, JSON.stringify({ version: 1, ideas: [{ ...idea, injected: { private: true } }] }))
  const read = new IdeaStore(storage).getSnapshot().ideas[0]
  assert.equal('injected' in read, false); assert.ok(generateCodexPrompt(read).includes('暂无额外排除项'))
})
test('Codex prompt matches a fixed complete snapshot and includes every required section', () => {
  const prompt = generateCodexPrompt(draft)
  assert.equal(prompt + '\n', readFileSync(new URL('./fixtures/codex-prompt.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n'))
  assert.equal(generateCodexPrompt({ ...draft }), prompt)
  for (const section of ['项目背景', '目标用户', '核心问题', 'V1 功能', '明确不做', '技术栈', '数据保存方式', 'UI 要求', '响应式要求', '测试要求', '安全要求', '完成后的汇报格式']) assert.ok(prompt.includes(section))
  assert.ok(!/undefined|null|\[object Object\]/.test(prompt))
  assert.ok(dataSavingSuggestion(['SQLite']).includes('SQLite'))
  assert.ok(dataSavingSuggestion(['IndexedDB']).includes('IndexedDB'))
  assert.ok(dataSavingSuggestion([]).includes('JSON'))
})
test('different project templates produce different V1s and do not mutate template defaults', () => {
  const data: GitHubDataset = JSON.parse(readFileSync(new URL('../public/data/repos.json', import.meta.url), 'utf8'))
  const repo = fromGitHub(data.repositories[0], data.metrics?.[String(data.repositories[0].githubId)])
  const evaluation = evaluateRepo(repo, data.generatedAt), generated = createIdeaDraft(repo, evaluation)
  generated.features.push('User edit')
  assert.ok(!getIdeaTemplate(evaluation.kind).features.includes('User edit'))
  const types = ['agent', 'cli', 'web', 'cv', 'learning', 'desktop'] as const
  assert.equal(new Set(types.map((kind) => getIdeaTemplate(kind).features.join('|'))).size, types.length)
})
