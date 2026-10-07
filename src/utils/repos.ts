import type { Category, Repo, TimeRange } from '../types/repo.ts'

export const timeRanges: { value: TimeRange; label: string; metric: string; days: number }[] = [
  { value: 'today', label: '今日', metric: '24h', days: 1 },
  { value: 'week', label: '本周', metric: '7d', days: 7 },
  { value: 'month', label: '本月', metric: '30d', days: 30 },
]
export function getGrowth(repo: Repo, range: TimeRange): number | null {
  return repo.radar.growth[range === 'week' ? 'week' : range === 'month' ? 'month' : 'day']
}
export function activityTime(repo: Repo): number | null {
  const value = repo.github.pushedAt ?? repo.github.updatedAt ?? repo.github.createdAt
  return value ? Date.parse(value) : null
}
export function selectRepos(repos: readonly Repo[], query: string, category: Category, range: TimeRange, referenceDate = new Date().toISOString()): Repo[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const period = timeRanges.find((item) => item.value === range)!
  const end = Date.parse(referenceDate)
  const start = end - period.days * 86400000
  return repos.filter((repo) => {
    const github = repo.github
    const text = [github.owner, github.name, github.description, github.language, ...(github.topics ?? []), ...repo.radar.tags, ...(repo.radar.analysis?.techStack ?? [])].filter(Boolean).join(' ').toLocaleLowerCase()
    const activity = activityTime(repo)
    const inWindow = repo.source === 'mock' || getGrowth(repo, range) !== null || (activity !== null && activity >= start && activity <= end)
    return inWindow && (category === '全部' || repo.radar.tags.includes(category)) && terms.every((term) => text.includes(term))
  }).sort((a, b) => {
    if (a.source === 'mock' && b.source === 'mock') return (getGrowth(b, range) ?? -1) - (getGrowth(a, range) ?? -1) || (b.radar.hotScore ?? -1) - (a.radar.hotScore ?? -1) || a.id.localeCompare(b.id)
    const ag = getGrowth(a, range), bg = getGrowth(b, range)
    if (ag !== null && bg === null) return -1
    if (ag === null && bg !== null) return 1
    if (ag !== null && bg !== null) {
      const hot = (b.radar.hotScore ?? -1) - (a.radar.hotScore ?? -1)
      const growth = bg - ag
      return (range === 'today' ? hot || growth : growth || hot) || a.id.localeCompare(b.id)
    }
    return (b.github.stars ?? -1) - (a.github.stars ?? -1) || (activityTime(b) ?? -1) - (activityTime(a) ?? -1) || a.id.localeCompare(b.id)
  })
}
export function formatCount(value: number | null): string {
  if (value === null) return '—'
  return value >= 1000 ? (value / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : value.toLocaleString('en-US')
}
export function signedGrowth(value: number | null): string { return value === null ? '积累中' : (value < 0 ? '↓ ' : '↑ +') + value.toLocaleString('en-US') }
export function hotGrade(score: number | null): string { return score === null ? '数据积累中' : score >= 90 ? '爆发' : score >= 75 ? '很热' : score >= 55 ? '上升' : '普通' }
export function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '—'
}
export function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—'
}
export function githubUrl(repo: Repo): string { return repo.github.htmlUrl }
export function safeHomepage(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}
export function licenseName(repo: Repo): string {
  const license = repo.github.license
  return (license?.spdxId && license.spdxId !== 'NOASSERTION' ? license.spdxId : license?.name) ?? '未提供'
}
export const languageColors: Record<string, string> = {
  Python: '#4277ae', TypeScript: '#3275c4', JavaScript: '#c3a542', Go: '#00a6ba', Rust: '#b47652', Java: '#b76444', 'C++': '#da5985', Dart: '#20a3bd',
}
