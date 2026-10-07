import { mkdir, writeFile, rename, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { createGitHubClient } from './github-http-client.mjs'
import { mapGitHubRepository, deduplicateRepositories, validateGitHubDataset } from '../shared/github-data.mjs'

export const OUTPUT_PATH = fileURLToPath(new URL('../public/data/repos.json', import.meta.url))
export const API_VERSION = '2022-11-28'

export function buildQueries(now = new Date()) {
  const daysAgo = (days) => new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10)
  const publicOnly = 'is:public archived:false fork:false'
  return [
    { name: 'recent-created', q: `created:>=${daysAgo(30)} stars:>=50 ${publicOnly}`, sort: 'stars' },
    { name: 'recent-active', q: `pushed:>=${daysAgo(7)} stars:>=500 ${publicOnly}`, sort: 'updated' },
    { name: 'ai-agents', q: `agent in:name,description stars:>=100 pushed:>=${daysAgo(30)} ${publicOnly}`, sort: 'stars' },
    { name: 'developer-tools', q: `topic:developer-tools stars:>=100 pushed:>=${daysAgo(30)} ${publicOnly}`, sort: 'stars' },
    { name: 'computer-vision', q: `topic:computer-vision stars:>=100 pushed:>=${daysAgo(30)} ${publicOnly}`, sort: 'stars' },
    { name: 'learning', q: `topic:education stars:>=100 pushed:>=${daysAgo(30)} ${publicOnly}`, sort: 'stars' },
  ].map((query) => ({ ...query, perPage: 20 }))
}

export function readRateLimit(headers) {
  return {
    limit: headers.get('x-ratelimit-limit'), remaining: headers.get('x-ratelimit-remaining'),
    reset: headers.get('x-ratelimit-reset'), resource: headers.get('x-ratelimit-resource'),
    retryAfter: headers.get('retry-after'),
  }
}

function rateMessage(rate) {
  return `Rate limit remaining: ${rate.remaining ?? 'unknown'}; limit: ${rate.limit ?? 'unknown'}; resource: ${rate.resource ?? 'unknown'}; reset: ${rate.reset ?? 'unknown'}`
}

export async function collectRepositories({ fetcher, token = process.env.GITHUB_TOKEN, now = new Date(), wait = sleep, log = console.log } = {}) {
  // Injected fixture fetchers run without consulting this computer's network/registry.
  const client = await createGitHubClient(fetcher ? { fetcher, env: {}, platform: 'test', log } : { log })
  try {
    const queries = buildQueries(now)
    const groups = []
    const completedQueries = []
    let lastRateLimit = null
    log(token ? 'Fetching public repositories with environment authentication.' : 'Fetching public repositories without authentication (token optional).')
    for (let index = 0; index < queries.length; index++) {
      if (index > 0) await wait(2100)
      const query = queries[index]
      const url = new URL('https://api.github.com/search/repositories')
      url.search = new URLSearchParams({ q: query.q, sort: query.sort, order: 'desc', per_page: String(query.perPage), page: '1' }).toString()
      const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': API_VERSION, 'User-Agent': 'RepoRadar-static-data' }
      if (token) headers.Authorization = `Bearer ${token}`
      log(`Query ${index + 1}/${queries.length}: ${query.name}`)
      const response = await client.request(url, { headers }, query.name)
      lastRateLimit = readRateLimit(response.headers)
      log(rateMessage(lastRateLimit))
      if (response.status === 403 || response.status === 429) {
        const guidance = lastRateLimit.retryAfter ? `Retry after: ${lastRateLimit.retryAfter}.` : lastRateLimit.reset ? `Rate limit reset (UTC epoch seconds): ${lastRateLimit.reset}.` : 'Wait at least one minute and check API permissions before another run.'
        throw new Error(`GitHub HTTP ${response.status} (${query.name}, ${client.describe(url)}; rate limit or permissions); this run stopped without retry. ${guidance} Previous JSON remains unchanged.`)
      }
      if (!response.ok) throw new Error(`GitHub HTTP error ${response.status} (${query.name}, ${client.describe(url)}); previous JSON remains unchanged.`)
      const payload = await client.json(response, url, query.name)
      if (!payload || !Array.isArray(payload.items) || payload.incomplete_results !== false || payload.items.length > query.perPage) throw new Error('GitHub search response is incomplete or malformed; previous JSON remains unchanged.')
      const mapped = payload.items.map(mapGitHubRepository)
      if (mapped.some((repo) => repo.archived === true || repo.fork === true)) throw new Error('Search returned excluded archived/fork repositories.')
      groups.push(mapped)
      completedQueries.push({ ...query, returned: mapped.length })
      if (lastRateLimit.remaining !== null && Number(lastRateLimit.remaining) <= 1 && index < queries.length - 1) throw new Error('Search rate limit remaining is too low; stopped before further requests. Previous JSON remains unchanged.')
    }
    // Round-robin keeps all six search strategies represented before applying the 100-repo cap.
    const interleaved = []
    for (let row = 0; row < 20; row++) for (const group of groups) if (group[row]) interleaved.push(group[row])
    const repositories = deduplicateRepositories(interleaved).slice(0, 100)
    if (repositories.length < 50) throw new Error(`Only ${repositories.length} distinct repositories; minimum 50 required. Previous JSON remains unchanged.`)
    const dataset = validateGitHubDataset({ version: 1, source: 'github', generatedAt: now.toISOString(), repoCount: repositories.length, queries: completedQueries, repositories })
    return { dataset, lastRateLimit }
  } finally { await client.close() }
}

export async function writeDatasetAtomically(dataset, outputPath = OUTPUT_PATH) {
  const checked = validateGitHubDataset(dataset)
  if (checked.repoCount < 50) throw new Error('Refusing to write a pool smaller than 50 repositories.')
  await mkdir(dirname(outputPath), { recursive: true })
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(checked, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    await rename(temporaryPath, outputPath)
  } finally { await rm(temporaryPath, { force: true }) }
}

export async function refreshRepositories(options = {}) {
  const result = await collectRepositories(options)
  await writeDatasetAtomically(result.dataset, options.outputPath ?? OUTPUT_PATH)
  return result
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { dataset } = await refreshRepositories()
    console.log(`Updated public/data/repos.json: ${dataset.repoCount} distinct public repositories; ${dataset.generatedAt}`)
  } catch (error) {
    console.error(`Data refresh stopped: ${error instanceof Error ? error.message : 'Unknown failure'}`)
    process.exitCode = 1
  }
}
