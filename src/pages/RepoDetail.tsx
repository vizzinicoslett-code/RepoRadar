import { Link, useLocation, useParams } from 'react-router-dom'
import { useRepos } from '../hooks/useRepos'
import { formatCount, formatDate, signedGrowth, hotGrade, githubUrl, languageColors, licenseName, safeHomepage } from '../utils/repos'
import { categories } from '../types/repo'
import { Icon } from '../components/Icon'
import { GrowthTrend } from '../components/GrowthTrend'
import { RepoDescription } from '../components/RepoDescription'
import { TranslationControl } from '../components/TranslationControl'
import { EmptyState } from '../components/EmptyState'
import { DataSourceStatus } from '../components/DataSourceStatus'
import { RepoCardSkeleton } from '../components/RepoCardSkeleton'
import { EvaluationPanel } from '../components/EvaluationPanel'
import { evaluateRepo } from '../services/evaluation/evaluateRepo'
import { getIdeaTemplate } from '../services/evaluation/ideaTemplates'
import type { Rating, Repo } from '../types/repo'

function RatingRow({ label, value }: { label: string; value: Rating }) {
  return <div className="rating-row"><span>{label}</span><span className="rating-stars" aria-label={value + ' / 5'}><span aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Icon key={index} name="star" size={17} className={index < value ? 'filled' : ''} />)}</span><small>{value}/5</small></span></div>
}

function ProjectOverview({ repo }: { repo: Repo }) {
  const github = repo.github
  const analysis = repo.radar.analysis
  const homepage = safeHomepage(github.homepage)
  return <section className="detail-panel">
    <div className="section-label">01 / OVERVIEW</div><h2>项目概览</h2>
    <h3>这是做什么的？</h3>{analysis ? <p>{analysis.overview}</p> : <RepoDescription text={github.description} />}
    {analysis && <><h3>核心功能</h3><ul className="feature-list">{analysis.coreFeatures.map((feature) => <li key={feature}><Icon name="check" size={16} />{feature}</li>)}</ul><h3>技术栈</h3><div className="repo-tags">{analysis.techStack.map((tech) => <span className="tag" key={tech}>{tech}</span>)}</div></>}
    <h3>Topics</h3>{github.topics?.length ? <div className="repo-tags">{github.topics.map((topic) => <span className="tag topic-tag" key={topic}>{topic}</span>)}</div> : <p>仓库未提供 Topics。</p>}
    <dl className="repo-facts">
      <div><dt>主要语言</dt><dd><span className="language-dot" style={{ background: languageColors[github.language ?? ''] ?? '#798293' }} />{github.language ?? '未标注'}</dd></div>
      <div><dt>Issues{repo.source === 'mock' ? '（未提供）' : ''}</dt><dd>{formatCount(github.openIssues)}{repo.source === 'github' && <span title="GitHub open_issues_count 包含打开的 Issues 与 Pull Requests">（含 PR）</span>}</dd></div>
      <div><dt>License{repo.source === 'mock' ? '（演示）' : ''}</dt><dd>{licenseName(repo)}</dd></div>
      <div><dt>创建日期{repo.source === 'mock' ? '（演示）' : ''}</dt><dd>{formatDate(github.createdAt)}</dd></div>
      <div><dt>更新时间{repo.source === 'mock' ? '（演示）' : ''}</dt><dd>{formatDate(github.updatedAt)}</dd></div>
      <div><dt>最近推送</dt><dd>{formatDate(github.pushedAt)}</dd></div>
      <div><dt>Homepage</dt><dd>{homepage ? <a className="homepage-link" href={homepage} target="_blank" rel="noopener noreferrer">{homepage}<Icon name="external" size={13} /></a> : '未提供可访问的主页'}</dd></div>
      <div><dt>仓库状态</dt><dd>{github.archived === true ? '已归档' : github.archived === false ? '未归档' : '—'}{github.fork === true ? ' · Fork 仓库' : github.fork === false ? ' · 原始仓库' : ''}</dd></div>
    </dl>
  </section>
}

export function RepoDetail() {
  const { id } = useParams()
  const location = useLocation()
  const { repos, loading, error, source, status, fallbackReason, generatedAt } = useRepos()
  const repo = repos.find((item) => item.id === id)
  const from: unknown = location.state?.from
  const backTo = typeof from === 'string' && (from === '/' || from.startsWith('/?')) ? from : '/'
  const analysis = repo?.radar.analysis
  const github = repo?.github
  const evaluation = repo ? repo.radar.evaluation ?? evaluateRepo(repo, generatedAt ?? new Date().toISOString()) : null
  const template = getIdeaTemplate(evaluation?.kind ?? 'unknown')

  return <main id="main-content" tabIndex={-1} className="container detail-page">
    <Link className="back-link" to={backTo}><Icon name="back" size={17} />返回发现</Link>
    {status === 'fallback' && <div className="source-notice" role="status"><Icon name="info" size={15} />{fallbackReason}</div>}
    {loading ? <><span className="sr-only" role="status">正在加载项目</span><RepoCardSkeleton /></> : error ? <EmptyState icon="info" title="暂时无法读取项目" description="请刷新页面后重试。" />
      : !repo || !github ? <EmptyState icon="radar" title="这个项目不在雷达范围内" description={source === 'mock' ? '当前使用演示数据，返回发现页探索可用项目。' : '项目可能不在当前候选池中，返回发现页探索其他灵感。'} />
      : <>
        <TranslationControl />
        <section className="detail-header">
          <div className="detail-title-row"><div><div className="eyebrow">REPOSITORY SPOTLIGHT <span className="mock-label">{repo.source === 'mock' ? 'MOCK' : 'GITHUB'}</span></div><h1><span>{github.owner} / </span>{github.name}</h1><RepoDescription text={github.description} /></div><a className="button button-primary" href={githubUrl(repo)} target="_blank" rel="noopener noreferrer">GitHub 页面<Icon name="external" size={16} /></a></div>
          <div className="repo-tags">{repo.radar.tags.map((tag) => {
            const category = categories.find((item) => item === tag) ?? (tag === 'AI Agent' || tag === 'Automation' ? 'AI / Agent' : '全部')
            return <Link key={tag} className="tag" to={'/?category=' + encodeURIComponent(category)}>{tag}</Link>
          })}</div>
          <div className="detail-metrics">
            <div><span><Icon name="star" size={16} />Stars</span><strong>{formatCount(github.stars)}</strong><small>{github.stars === null ? '未提供' : github.stars.toLocaleString('en-US') + ' total'}</small></div>
            <div><span><Icon name="fork" size={16} />Forks</span><strong>{formatCount(github.forks)}</strong><small>社区分支</small></div>
            <div className="detail-growth"><span><Icon name="growth" size={16} />24h 增长</span><strong>{repo.radar.growth.day === null ? '—' : signedGrowth(repo.radar.growth.day)}</strong><small>{repo.radar.growth.day === null ? '增长数据积累中' : '7d ' + signedGrowth(repo.radar.growth.week) + ' · 30d ' + signedGrowth(repo.radar.growth.month)}</small></div>
            <div><span><Icon name="flame" size={16} />Hot Score</span><strong>{repo.radar.hotScore === null ? '—' : <>{repo.radar.hotScore}<em>/ 100</em></>}</strong><small>{repo.source === 'mock' ? '预设演示分数' : hotGrade(repo.radar.hotScore)}</small></div>
          </div>
          <div className="detail-data-note"><Icon name="info" size={14} />{repo.source === 'mock' ? '热度、增长、日期与 License 为演示内容；开发评分由透明规则计算。' : '仓库字段来自 GitHub REST API；增长来自实测快照，Hot 为透明规则分数。开发判断仅依据元数据，不是 AI 或 README 分析。'}</div>
          <div className="detail-source"><DataSourceStatus /></div>
        </section>
        <div className="detail-layout"><div className="detail-main">
          <ProjectOverview repo={repo} />
          {repo.source === 'github' && <GrowthTrend repo={repo} />}
          {evaluation && <EvaluationPanel evaluation={evaluation} repoId={repo.id} />}
          <section className="detail-panel build-panel"><div className="section-label">03 / YOUR NEXT BUILD</div><h2>如果你来做</h2>
            {analysis ? <><p>{analysis.buildIdea}</p><div className="build-plan"><span className="build-plan-title"><Icon name="code" size={17} />V1 · 从最小可用版本开始</span><ol>{analysis.buildSteps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>)}</ol></div><h3>适合扩展方向</h3><div className="repo-tags">{analysis.extensionIdeas.map((idea) => <span className="tag tag-accent" key={idea}>{idea}</span>)}</div></>
              : <><p>{template.name}：{template.problem}</p><div className="build-plan"><span className="build-plan-title">推荐 V1 · 类别模板建议</span><ol>{template.features.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>)}</ol></div><Link className="text-link" to={'/idea/' + repo.id}>编辑我的个人版本 →</Link></>}
          </section>
        </div><aside className="detail-aside"><section className="detail-panel judgment-panel"><div className="section-label">BEFORE YOU BUILD</div><h2>{analysis ? '演示编辑示例' : '先了解，再动手'}</h2>
          {analysis ? <><span className="judgment-note">本地编辑示例 · 非 AI 分析</span><div className="ratings"><RatingRow label="开发难度" value={analysis.difficulty} /><RatingRow label="个人开发者适合度" value={analysis.soloDeveloperScore} /><RatingRow label="Codex 复刻适合度" value={analysis.codexScore} /></div><h3>为什么正在变热？</h3><p>{analysis.whyTrending}</p><h3>为什么值得关注？</h3><p>{analysis.whyInteresting}</p><div className="judgment-tip"><Icon name="code" size={18} /><p>从一个具体问题开始，做小一点，把核心体验做完整。</p></div></>
            : <><span className="judgment-note">透明规则 · 非 AI</span><p>Hot 回答现在有多火，Build 回答多适合个人 + Codex 开发。完整原项目与建议 V1 的范围不同。</p><p>先检查原项目文档与 License，确认输入、输出和可测试的验收标准，再保存自己的灵感。</p><Link className="text-link" to="/ideas">我的灵感 →</Link></>}
        </section></aside></div>
      </>}
  </main>
}
