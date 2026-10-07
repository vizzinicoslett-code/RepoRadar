import { useRepos } from '../hooks/useRepos'
import { formatTimestamp } from '../utils/repos'

export function DataSourceStatus() {
  const { source, generatedAt, repoCount, loading, error, fallbackReason } = useRepos()
  return <span className="data-source-status" title={fallbackReason ?? undefined}>
    <span className="mock-label"><span className="status-dot" />{loading ? '正在加载数据' : error ? '数据暂不可用' : source === 'github' ? 'GitHub 静态数据' : '当前显示演示数据'}</span>
    {source === 'github' && <span className="data-updated">{repoCount} 个候选 · 更新于 {formatTimestamp(generatedAt)}（北京时间）</span>}
  </span>
}
