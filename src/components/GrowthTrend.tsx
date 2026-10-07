import type { Repo } from '../types/repo'
import { formatDate, signedGrowth } from '../utils/repos'
export function GrowthTrend({ repo }: { repo: Repo }) {
  const snapshots = repo.radar.metrics?.snapshots ?? []
  const stars = snapshots.map((s) => s.stars)
  const min = Math.min(...stars), max = Math.max(...stars)
  const first = snapshots.length ? Date.parse(snapshots[0].capturedAt) : 0
  const span = snapshots.length ? Date.parse(snapshots.at(-1)!.capturedAt) - first : 0
  const points = snapshots.map((s) => `${10 + (Date.parse(s.capturedAt) - first) / (span || 1) * 580},${80 - (s.stars - min) / (max - min || 1) * 65}`).join(' ')
  return <section className="detail-panel growth-trend"><div className="section-label">STAR HISTORY</div><h2>增长趋势</h2>
    <div className="trend-metrics">{(['day', 'week', 'month'] as const).map((key, index) => {
      const detail = repo.radar.metrics?.growth[key]
      return <div key={key}><span>{['24h', '7d', '30d'][index]}</span><strong>{signedGrowth(detail?.delta ?? null)}</strong>{detail && <><small>{detail.rate === null ? '增长率 —（零基准）' : (detail.rate >= 0 ? '+' : '') + (detail.rate * 100).toFixed(2) + '%'}</small><small>基准 {detail.baselineStars.toLocaleString('en-US')} Stars · {formatDate(detail.baselineCapturedAt)}</small><small>实际窗口 {detail.actualWindowHours.toFixed(1)} 小时</small></>}</div>
    })}</div>
    {snapshots.length > 1 ? <svg className="star-sparkline" viewBox="0 0 600 95" role="img" aria-label={'真实 Star 快照趋势，共 ' + snapshots.length + ' 个点'}><polyline fill="none" stroke="currentColor" strokeWidth="2.5" points={points} vectorEffect="non-scaling-stroke" /></svg> : <p className="window-note">当前记录 {snapshots.length} 个真实快照，等待下一次观测。</p>}
    <p className="window-note">当前 {repo.github.stars?.toLocaleString('en-US') ?? '—'} Stars · 不补造历史；Hot 只比较当前候选池。</p>
  </section>
}
