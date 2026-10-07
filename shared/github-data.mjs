import { validateMetrics } from './star-history.mjs'
// Pure shared functions: the Node 20+ fetch script and browser validate the same schema.
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value) => typeof value === 'string' && value.trim() ? value : null
const count = (value) => value == null ? null : Number.isSafeInteger(value) && value >= 0 ? value : (() => { throw new Error('Invalid non-negative repository count') })()
const date = (value) => value == null ? null : typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : (() => { throw new Error('Invalid repository timestamp') })()
const bool = (value) => value == null ? null : typeof value === 'boolean' ? value : (() => { throw new Error('Invalid repository flag') })()

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${label}`)
  return value
}

function nullableText(value) {
  if (value === null || typeof value === 'string') return value
  throw new Error('Expected string or null')
}

function validateRepository(repo) {
  if (!isRecord(repo) || !Number.isSafeInteger(repo.githubId) || repo.githubId <= 0) throw new Error('Missing GitHub repository ID')
  const owner = requiredText(repo.owner, 'owner')
  const name = requiredText(repo.name, 'name')
  const fullName = requiredText(repo.fullName, 'fullName')
  if (!/^[a-zA-Z0-9-]+$/.test(owner) || !/^[a-zA-Z0-9_.-]+$/.test(name) || fullName !== `${owner}/${name}`) throw new Error('Invalid repository identity')
  const htmlUrl = requiredText(repo.htmlUrl, 'htmlUrl')
  if (htmlUrl !== `https://github.com/${owner}/${name}`) throw new Error('Invalid GitHub repository URL')
  for (const key of ['stars', 'forks', 'openIssues', 'createdAt', 'updatedAt', 'pushedAt', 'archived', 'fork']) {
    if (!(key in repo)) throw new Error(`Missing repository field: ${key}`)
  }
  if (repo.topics !== null && (!Array.isArray(repo.topics) || !repo.topics.every((item) => typeof item === 'string'))) throw new Error('Invalid topics')
  let license = null
  if (repo.license !== null) {
    if (!isRecord(repo.license)) throw new Error('Invalid license')
    license = { key: nullableText(repo.license.key), name: nullableText(repo.license.name), spdxId: nullableText(repo.license.spdxId) }
  }
  return {
    githubId: repo.githubId, owner, name, fullName,
    description: nullableText(repo.description), htmlUrl,
    homepage: nullableText(repo.homepage), language: nullableText(repo.language),
    stars: count(repo.stars), forks: count(repo.forks), openIssues: count(repo.openIssues),
    topics: repo.topics === null ? null : [...new Set(repo.topics)], license,
    createdAt: date(repo.createdAt), updatedAt: date(repo.updatedAt), pushedAt: date(repo.pushedAt),
    archived: bool(repo.archived), fork: bool(repo.fork),
  }
}

export function mapGitHubRepository(item) {
  if (!isRecord(item) || item.private === true) throw new Error('Expected a public GitHub repository')
  if (item.topics != null && (!Array.isArray(item.topics) || !item.topics.every((topic) => typeof topic === 'string'))) throw new Error('Invalid API topics')
  if (item.license != null && !isRecord(item.license)) throw new Error('Invalid API license')
  return validateRepository({
    githubId: item.id, owner: item.owner?.login, name: item.name,
    fullName: item.full_name, description: item.description == null ? null : nullableText(item.description),
    htmlUrl: item.html_url, homepage: item.homepage == null ? null : nullableText(item.homepage),
    language: item.language == null ? null : nullableText(item.language),
    stars: item.stargazers_count ?? null, forks: item.forks_count ?? null, openIssues: item.open_issues_count ?? null,
    topics: item.topics ?? null,
    license: item.license == null ? null : { key: text(item.license.key), name: text(item.license.name), spdxId: text(item.license.spdx_id) },
    createdAt: item.created_at ?? null, updatedAt: item.updated_at ?? null, pushedAt: item.pushed_at ?? null,
    archived: item.archived ?? null, fork: item.fork ?? null,
  })
}

export function deduplicateRepositories(repositories) {
  const ids = new Set()
  return repositories.filter((repo) => {
    if (ids.has(repo.githubId)) return false
    ids.add(repo.githubId)
    return true
  })
}

export function validateGitHubDataset(value) {
  if (!isRecord(value) || value.version !== 1 || value.source !== 'github') throw new Error('Unsupported dataset version or source')
  if (typeof value.generatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value.generatedAt) || !Number.isFinite(Date.parse(value.generatedAt))) throw new Error('Invalid generation timestamp')
  if (!Array.isArray(value.repositories) || value.repositories.length < 1 || value.repositories.length > 100 || value.repoCount !== value.repositories.length) throw new Error('Invalid repository pool size')
  const repositories = value.repositories.map(validateRepository)
  if (deduplicateRepositories(repositories).length !== repositories.length) throw new Error('Duplicate GitHub repository ID')
  if (!Array.isArray(value.queries) || value.queries.length > 10) throw new Error('Invalid query metadata')
  const queries = value.queries.map((query) => {
    if (!isRecord(query) || !['stars', 'updated'].includes(query.sort) || !Number.isInteger(query.perPage) || query.perPage < 1 || query.perPage > 100 || !Number.isInteger(query.returned) || query.returned < 0 || query.returned > query.perPage) throw new Error('Invalid query metadata')
    return { name: requiredText(query.name, 'query name'), q: requiredText(query.q, 'query'), sort: query.sort, perPage: query.perPage, returned: query.returned }
  })
  // Return only whitelisted fields; raw response bodies, headers and credentials never survive.
  const metrics = value.metrics === undefined ? undefined : validateMetrics(value.metrics, repositories, value.generatedAt)
  return { version: 1, generatedAt: value.generatedAt, source: 'github', repoCount: repositories.length, queries, repositories, ...(metrics ? { metrics } : {}) }
}

const rules = [
  ['AI / Agent', /\b(agent|agents|agentic|tool-use|browser-agent|coding-agent)\b|智能体|工具调用/i],
  ['Computer Vision', /\b(computer-vision|object-detection|image-segmentation|opencv|yolo|image-recognition|vision-model)\b|computer vision|计算机视觉|目标检测/i],
  ['开发工具', /\b(developer-tools|devtools|sdk|cli|compiler|debugger|framework|linter|code-editor|api-client|ide)\b|developer tool|开发工具|调试/i],
  ['学习工具', /\b(education|educational|learning-resource|tutorial|tutorials|course|courses|study|flashcards|learn-to-code)\b|learning tool|学习工具|教程|课程/i],
  ['App', /\b(app|application|desktop-app|mobile-app|web-app|android|ios|flutter|electron|tauri)\b|桌面应用|移动应用/i],
  ['效率工具', /\b(productivity|automation|workflow|launcher|note-taking|notes|task-manager|clipboard)\b|效率工具|自动化/i],
  ['有趣项目', /\b(game|games|fun|creative-coding|generative-art|pixel-art|simulation)\b|小游戏|创意编程/i],
]

export function deriveRepoTags(repo) {
  const haystack = [repo.name, repo.description, repo.language, ...(repo.topics ?? [])].filter(Boolean).join(' ')
  return rules.filter(([, pattern]) => pattern.test(haystack)).map(([tag]) => tag)
}
