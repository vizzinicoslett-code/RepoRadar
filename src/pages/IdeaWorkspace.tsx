import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useRepos } from '../hooks/useRepos'
import { useIdeas } from '../hooks/useIdeas'
import { evaluateRepo } from '../services/evaluation/evaluateRepo'
import { getIdeaTemplate } from '../services/evaluation/ideaTemplates'
import { createIdeaDraft } from '../services/ideas/ideaGenerator'
import { ideaStatuses } from '../services/ideas/ideaTypes'
import type { IdeaDraft, ProjectIdea } from '../services/ideas/ideaTypes'
import type { Repo } from '../types/repo'
import { EmptyState } from '../components/EmptyState'
import { MetricBadge } from '../components/MetricBadge'

const lines = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
function Difficulty({ value }: { value: number }) {
  const stars = Math.max(1, Math.ceil(value / 20))
  return <span aria-label={value + ' / 100'}><span aria-hidden="true">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span><small>{value} / 100</small></span>
}
function IdeaEditor({ initial, savedId, repo, referenceDate }: { initial: IdeaDraft | ProjectIdea; savedId?: string; repo?: Repo; referenceDate: string }) {
  const { store, warning, persistent } = useIdeas()
  const location = useLocation(), navigate = useNavigate()
  const [draft, setDraft] = useState<IdeaDraft>(initial)
  const [listText, setListText] = useState({ features: initial.features.join('\n'), excludedFeatures: initial.excludedFeatures.join('\n'), techStack: initial.techStack.join('\n') })
  const [error, setError] = useState(''), [saved, setSaved] = useState(Boolean(savedId) || Boolean(location.state?.saved)), [dirty, setDirty] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const evaluation = repo ? repo.radar.evaluation ?? evaluateRepo(repo, referenceDate) : null
  const template = getIdeaTemplate(evaluation?.kind ?? 'unknown')
  const change = (key: 'title' | 'targetUser' | 'problem' | 'notes' | 'status', value: string) => { setDraft({ ...draft, [key]: value }); setDirty(true); setSaved(false) }
  function save(prompt = false) {
    if (!form.current?.reportValidity()) return
    try {
      const idea = store.save({ ...draft, features: lines(listText.features), excludedFeatures: lines(listText.excludedFeatures), techStack: lines(listText.techStack) }, savedId)
      setError(''); setSaved(true); setDirty(false)
      navigate('/idea/' + idea.id + (prompt ? '/prompt' : ''), { replace: !prompt, state: { saved: true } })
    } catch (failure) { setError(failure instanceof Error ? failure.message : '暂时无法保存，请重试。') }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); save() }
  return <main id="main-content" tabIndex={-1} className="container secondary-page idea-workspace">
    <Link className="back-link" to="/ideas">← 我的灵感</Link><div className="page-heading"><span className="eyebrow">IDEA WORKSPACE</span><h1>从这个项目开始</h1><p>把一个值得借鉴的想法，变成你能完成的第一版。</p></div>
    <section className="idea-source"><div><span className="section-label">灵感来源</span><h2>{initial.sourceFullName}</h2>{repo ? <Link className="text-link" to={'/repo/' + initial.sourceRepoId}>返回原项目 →</Link> : <p>来源已不在当前候选池，已保存的灵感仍可编辑。<a className="text-link" href={'https://github.com/' + initial.sourceFullName} target="_blank" rel="noopener noreferrer"> 查看 GitHub 来源 ↗</a></p>}</div><div className="idea-source-metrics"><MetricBadge kind="hot" value={repo?.radar.hotScore ?? null} /><MetricBadge kind="growth" value={repo?.radar.growth.day ?? null} label="24h" /><span className="build-chip">Build {evaluation?.buildScore ?? '—'}</span></div></section>
    {warning && <p className="storage-notice" role="status">{warning}</p>}
    <div className="idea-layout"><div><section className="detail-panel scope-panel"><h2>先做一个能独立成立的小版本</h2><p>不要从“复刻完整项目”开始。先做一个能够独立成立的小版本。</p><div className="complexity-comparison"><div><span>原项目复杂度</span>{evaluation ? <Difficulty value={evaluation.complexityScore} /> : <strong>暂不可用</strong>}</div><div><span>建议个人版本 · {template.name}</span><Difficulty value={template.complexity} /></div></div><h3>缩小方案</h3><ul>{template.scope.map((item) => <li key={item}>{item}</li>)}</ul><p className="template-note">这是按项目类型生成的建议，并非对原项目功能的事实总结。请根据自己的目标编辑。</p></section>
    <form className="detail-panel idea-form" ref={form} onSubmit={submit}><h2>定义你的项目</h2><p>保存后只存在当前浏览器。V1、排除项和技术栈每行填写一项。</p><div className="form-grid">
      <label>项目名称<input aria-label="项目名称" name="title" value={draft.title} required maxLength={120} onChange={(event) => change('title', event.target.value)} /></label>
      <label>目标用户<input aria-label="目标用户" name="targetUser" value={draft.targetUser} required maxLength={500} onChange={(event) => change('targetUser', event.target.value)} /></label>
      <label className="form-wide">我要解决的问题<textarea aria-label="我要解决的问题" name="problem" value={draft.problem} required maxLength={4000} rows={3} onChange={(event) => change('problem', event.target.value)} /></label>
      {(['features', 'excludedFeatures', 'techStack'] as const).map((key) => <label key={key} className="form-wide">{key === 'features' ? 'V1 核心功能' : key === 'excludedFeatures' ? '明确不做什么' : '技术栈'}<textarea aria-label={key === 'features' ? 'V1 核心功能' : key === 'excludedFeatures' ? '明确不做什么' : '技术栈'} name={key} value={listText[key]} required={key !== 'excludedFeatures'} maxLength={25000} rows={key === 'techStack' ? 4 : 5} onChange={(event) => { setListText({ ...listText, [key]: event.target.value }); setDirty(true); setSaved(false) }} /></label>)}
      <label className="form-wide">备注<textarea aria-label="备注" name="notes" value={draft.notes} maxLength={8000} rows={3} onChange={(event) => change('notes', event.target.value)} /></label>
      <label>状态<select aria-label="状态" name="status" value={draft.status} onChange={(event) => change('status', event.target.value)}>{ideaStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
    </div>{error && <p className="form-error" role="alert">{error}</p>}<div className="idea-save-row"><button className="button button-primary" type="submit">保存灵感</button><span role="status">{dirty ? '有未保存的更改' : saved ? persistent ? '已保存到当前浏览器' : '仅保存在当前页面内存' : '尚未保存'}</span></div>
    <section className="prompt-launch"><h3>生成 Codex 开发方案</h3><p>根据你的项目设定自动整理，不调用 AI。点击后先保存当前编辑，再显示完整 Prompt。</p><button type="button" className="button button-primary" onClick={() => save(true)}>生成 Codex 开发方案 →</button></section></form></div>
    <aside className="idea-aside"><section className="detail-panel"><div className="section-label">SUGGESTED V1</div><h2>推荐 V1</h2><ol>{template.features.map((feature) => <li key={feature}>{feature}</li>)}</ol><h3>建议技术栈</h3><div className="repo-tags">{template.techStack.map((item) => <span className="tag" key={item}>{item}</span>)}</div><p className="template-note">为个人简化版选择，未机械复制原仓库。表单内容由你最终确定。</p></section></aside></div>
  </main>
}
export function IdeaWorkspace() {
  const { id } = useParams(), { repos, generatedAt, loading } = useRepos(), { ideas } = useIdeas()
  const saved = ideas.find((idea) => idea.id === id)
  const repo = repos.find((item) => item.id === (saved?.sourceRepoId ?? id))
  if (!saved && loading) return <main id="main-content" tabIndex={-1} className="container secondary-page"><p role="status">正在读取灵感来源…</p></main>
  if (!saved && !repo) return <main id="main-content" tabIndex={-1} className="container secondary-page"><EmptyState title="没有找到这条灵感或来源项目" description="来源可能不在当前候选池中。已有灵感仍可在我的灵感中继续编辑。" /><Link to="/ideas" className="button button-primary">我的灵感</Link></main>
  const referenceDate = generatedAt ?? new Date().toISOString()
  const draft = saved ?? createIdeaDraft(repo!, repo!.radar.evaluation ?? evaluateRepo(repo!, referenceDate))
  return <IdeaEditor key={id} initial={draft} savedId={saved?.id} repo={repo} referenceDate={referenceDate} />
}
