const HOUR = 3600000
export const WINDOWS = { day: [24, 8], week: [168, 18], month: [720, 36] }
export const WEIGHTS = { absolute24h: 0.45, relative24h: 0.25, absolute7d: 0.20, activity: 0.10 }
const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const timestamp = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v))
const count = (v) => Number.isSafeInteger(v) && v >= 0

export function emptyHistory(now) {
  return { version: 1, updatedAt: now, retentionDays: 35, repositories: {} }
}

export function validateHistory(value) {
  if (!record(value) || value.version !== 1 || value.retentionDays !== 35 || !timestamp(value.updatedAt) || !record(value.repositories)) throw new Error('Invalid Star history metadata')
  const repositories = {}
  for (const [id, entry] of Object.entries(value.repositories)) {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !record(entry) || typeof entry.fullName !== 'string' || !/^[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(entry.fullName) || !Array.isArray(entry.snapshots)) throw new Error('Invalid history repository')
    let previous = -Infinity
    const snapshots = entry.snapshots.map((snapshot) => {
      if (!record(snapshot) || !timestamp(snapshot.capturedAt) || !count(snapshot.stars) || Date.parse(snapshot.capturedAt) <= previous || Date.parse(snapshot.capturedAt) > Date.parse(value.updatedAt)) throw new Error('Invalid or duplicate history snapshot')
      previous = Date.parse(snapshot.capturedAt)
      return { capturedAt: snapshot.capturedAt, stars: snapshot.stars }
    })
    repositories[id] = { fullName: entry.fullName, snapshots }
  }
  return { version: 1, updatedAt: value.updatedAt, retentionDays: 35, repositories }
}

export function captureSnapshots(history, repositories, now) {
  const checked = validateHistory(history)
  if (!timestamp(now) || Date.parse(now) < Date.parse(checked.updatedAt)) throw new Error('Capture time precedes history')
  const cutoff = Date.parse(now) - 35 * 24 * HOUR
  const entries = {}
  for (const [id, entry] of Object.entries(checked.repositories)) {
    const snapshots = entry.snapshots.filter((s) => Date.parse(s.capturedAt) >= cutoff)
    if (snapshots.length) entries[id] = { ...entry, snapshots }
  }
  const seen = new Set()
  for (const repo of repositories) {
    if (!Number.isSafeInteger(repo.githubId) || repo.githubId <= 0 || !count(repo.stars)) throw new Error('Cannot snapshot missing ID or Stars')
    if (seen.has(repo.githubId)) continue
    seen.add(repo.githubId)
    const entry = entries[repo.githubId] ?? { fullName: repo.fullName, snapshots: [] }
    entry.fullName = repo.fullName
    const last = entry.snapshots.at(-1)
    if (!last || Date.parse(now) - Date.parse(last.capturedAt) >= 3 * HOUR) entry.snapshots.push({ capturedAt: now, stars: repo.stars })
    entries[repo.githubId] = entry
  }
  return validateHistory({ ...checked, updatedAt: now, repositories: entries })
}

export function calculateGrowth(currentStars, snapshots, now, period) {
  const [hours, tolerance] = WINDOWS[period]
  const end = Date.parse(now)
  const target = end - hours * HOUR
  const baseline = snapshots.filter((s) => Date.parse(s.capturedAt) < end && Math.abs(Date.parse(s.capturedAt) - target) <= tolerance * HOUR)
    .sort((a, b) => Math.abs(Date.parse(a.capturedAt) - target) - Math.abs(Date.parse(b.capturedAt) - target) || Date.parse(a.capturedAt) - Date.parse(b.capturedAt))[0]
  if (currentStars === null || !baseline) return null
  const delta = currentStars - baseline.stars
  return { delta, rate: baseline.stars === 0 ? null : delta / baseline.stars, baselineCapturedAt: baseline.capturedAt, baselineStars: baseline.stars, actualWindowHours: (end - Date.parse(baseline.capturedAt)) / HOUR }
}

// Midrank of ties in [0,1]. Nonpositive growth contributes zero even if all peers tie.
export function percentile(value, pool) {
  if (value <= 0) return 0
  if (pool.length === 1) return 1
  const less = pool.filter((x) => x < value).length
  const equal = pool.filter((x) => x === value).length
  return (less + (equal - 1) / 2) / (pool.length - 1)
}

export function deriveMetrics(repositories, history, now) {
  const checked = validateHistory(history)
  const metrics = {}
  for (const repo of repositories) {
    const snapshots = (checked.repositories[repo.githubId]?.snapshots ?? []).filter((s) => Date.parse(s.capturedAt) <= Date.parse(now))
    const growth = Object.fromEntries(Object.keys(WINDOWS).map((period) => [period, calculateGrowth(repo.stars, snapshots, now, period)]))
    metrics[repo.githubId] = { growth, hotScore: null, hotComponents: null, snapshots }
  }
  const all = Object.values(metrics)
  const dayPool = all.filter((m) => m.growth.day !== null).map((m) => Math.log1p(Math.max(m.growth.day.delta, 0)))
  const ratePool = all.filter((m) => m.growth.day?.rate != null).map((m) => Math.max(m.growth.day.rate, 0))
  const weekPool = all.filter((m) => m.growth.week !== null).map((m) => Math.log1p(Math.max(m.growth.week.delta, 0)))
  for (const repo of repositories) {
    const m = metrics[repo.githubId]
    if (m.growth.day === null) continue
    const ageDays = repo.pushedAt === null ? null : (Date.parse(now) - Date.parse(repo.pushedAt)) / (24 * HOUR)
    const components = {
      absolute24h: percentile(Math.log1p(Math.max(m.growth.day.delta, 0)), dayPool),
      relative24h: m.growth.day.rate === null ? null : percentile(Math.max(m.growth.day.rate, 0), ratePool),
      absolute7d: m.growth.week === null ? null : percentile(Math.log1p(Math.max(m.growth.week.delta, 0)), weekPool),
      activity: ageDays === null || ageDays < 0 ? null : Math.max(0, 1 - ageDays / 30),
    }
    const available = Object.entries(components).filter(([, value]) => value !== null)
    const weight = available.reduce((sum, [key]) => sum + WEIGHTS[key], 0)
    m.hotScore = Math.round(100 * available.reduce((sum, [key, value]) => sum + WEIGHTS[key] * value, 0) / weight)
    m.hotComponents = components
  }
  return metrics
}

export function validateMetrics(value, repositories, now) {
  if (!record(value) || Object.keys(value).length !== repositories.length) throw new Error('Invalid metrics pool')
  const checked = {}
  for (const repo of repositories) {
    const metric = value[repo.githubId]
    if (!record(metric) || !record(metric.growth) || !Array.isArray(metric.snapshots)) throw new Error('Invalid derived metrics')
    const history = validateHistory({ ...emptyHistory(now), repositories: { [repo.githubId]: { fullName: repo.fullName, snapshots: metric.snapshots } } })
    const snapshots = history.repositories[repo.githubId].snapshots
    const growth = Object.fromEntries(Object.keys(WINDOWS).map((period) => [period, calculateGrowth(repo.stars, snapshots, now, period)]))
    if (JSON.stringify(growth) !== JSON.stringify(metric.growth)) throw new Error('Growth does not match observed snapshots')
    checked[repo.githubId] = { growth, hotScore: metric.hotScore, hotComponents: metric.hotComponents, snapshots }
  }
  const calculated = deriveMetrics(repositories, { ...emptyHistory(now), repositories: Object.fromEntries(repositories.map((r) => [r.githubId, { fullName: r.fullName, snapshots: checked[r.githubId].snapshots }])) }, now)
  for (const repo of repositories) {
    if (JSON.stringify(checked[repo.githubId]) !== JSON.stringify(calculated[repo.githubId])) throw new Error('Hot Score does not match transparent formula')
  }
  return calculated
}
