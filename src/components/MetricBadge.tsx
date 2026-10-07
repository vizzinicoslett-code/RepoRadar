import { Icon } from './Icon'
import { hotGrade } from '../utils/repos'

export function MetricBadge({ kind, value, label }: { kind: 'growth' | 'hot'; value: number | null; label?: string }) {
  const pending = value === null
  return <span className={'metric-badge metric-' + kind + (pending ? ' metric-pending' : '') + (value !== null && value < 0 ? ' metric-negative' : '')} title={pending ? '尚无足够历史快照' : kind === 'hot' ? hotGrade(value) + ' · 当前候选池相对热度（Mock 模式为演示）' : '当前 Stars 减去所选周期基准 Stars（Mock 模式为演示）'}>
    {pending ? <Icon name="info" size={14} /> : kind === 'growth' ? <span aria-hidden="true">{value < 0 ? '↓' : '↑'}</span> : <Icon name="flame" size={14} />}
    {pending ? <span>{kind === 'growth' ? (label ?? '24h') + ' 数据积累中' : 'Hot —'}</span> : kind === 'growth' ? <><span>{label ?? '24h'}</span><strong>{value >= 0 ? '+' : ''}{value.toLocaleString('en-US')}</strong></> : <><span>Hot</span><strong>{value}</strong><span>{hotGrade(value)}</span></>}
  </span>
}
