import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useIdeas } from '../hooks/useIdeas'
import { formatTimestamp } from '../utils/repos'
import { EmptyState } from '../components/EmptyState'
export function Ideas() {
  const { ideas, store, warning } = useIdeas(), [deleting, setDeleting] = useState<string | null>(null)
  return <main id="main-content" tabIndex={-1} className="container secondary-page ideas-page"><div className="page-heading"><span className="eyebrow">YOUR NEXT PROJECT</span><h1>我的灵感</h1><p>把发现变成可以开始的小项目。仅保存在当前浏览器。</p></div>{warning && <p className="storage-notice" role="status">{warning}</p>}
    {ideas.length === 0 ? <><EmptyState title="还没有保存灵感" description="从发现页打开项目，查看判断，再点击“我想做类似项目”。" /><Link className="button button-primary" to="/?mode=build">寻找下一个项目 →</Link></> : <div className="ideas-grid">{[...ideas].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).map((idea) => <article className="idea-card" key={idea.id}><div className="idea-card-top"><span className="tag">{idea.status}</span><small>最后修改 {formatTimestamp(idea.updatedAt)}</small></div><h2>{idea.title}</h2><p>来源：{idea.sourceFullName}</p><p className="idea-card-problem">{idea.problem}</p><div className="idea-card-actions"><Link className="text-link" to={'/idea/' + idea.id}>继续编辑 →</Link><button className="delete-idea" onClick={() => setDeleting(idea.id)}>删除</button></div>{deleting === idea.id && <div className="delete-confirm" role="alert"><p>删除“{idea.title}”？删除后无法恢复。</p><button onClick={() => { store.delete(idea.id); setDeleting(null) }}>确认删除</button><button onClick={() => setDeleting(null)}>取消</button></div>}</article>)}</div>}
  </main>
}
