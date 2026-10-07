import { timeRanges } from '../utils/repos'
import type { TimeRange } from '../types/repo'

export function TimeFilter({ value, onChange }: { value: TimeRange; onChange: (range: TimeRange) => void }) {
  return <div className="time-filter" role="group" aria-label="增长时间范围">
    {timeRanges.map((range) => <button key={range.value} aria-pressed={value === range.value} className={value === range.value ? 'selected' : ''} onClick={() => onChange(range.value)}>{range.label}</button>)}
  </div>
}
