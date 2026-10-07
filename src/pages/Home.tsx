import { Link, useSearchParams } from 'react-router-dom'
import { categories } from '../types/repo'
import type { Category, TimeRange } from '../types/repo'
import { useRepos } from '../hooks/useRepos'
import { formatCount, signedGrowth, getGrowth, selectRepos, timeRanges } from '../utils/repos'
import { SearchBar } from '../components/SearchBar'
import { CategoryFilter } from '../components/CategoryFilter'
import { TimeFilter } from '../components/TimeFilter'
import { TranslationControl } from '../components/TranslationControl'
import { RepoCard } from '../components/RepoCard'
import { RepoCardSkeleton } from '../components/RepoCardSkeleton'
import { EmptyState } from '../components/EmptyState'
import { DataSourceStatus } from '../components/DataSourceStatus'
import { Icon } from '../components/Icon'

export function Home() {
  const { repos, loading, error, source, generatedAt, status, fallbackReason } = useRepos()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const rawCategory = params.get('category')
  const requestedCategory = categories.find((item) => item === rawCategory) ?? '全部'
  const category: Category = source === 'github' && (requestedCategory === '值得复刻' || requestedCategory === '一个人能做') ? '全部' : requestedCategory
  const rawRange = params.get('range')
  const range: TimeRange = rawRange === 'week' || rawRange === 'month' ? rawRange : 'today'
  const selectedRange = timeRanges.find((item) => item.value === range)!
  const filtered = selectRepos(repos, query, category, range, generatedAt ?? undefined)
  const leader = selectRepos(repos, '', '全部', range, generatedAt ?? undefined)[0]
  const inspiration = repos.find((repo) => repo.id === 'raycast-extensions')
  const isGithub = source === 'github'
  const isMock = source === 'mock'
  const growthReady = repos.filter((repo) => repo.source === 'github' && getGrowth(repo, range) !== null).length

  function updateParam(key: string, value: string, defaultValue = '') {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value === defaultValue) next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
  }

  return <main id="main-content" tabIndex={-1} className="container home-page">
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy"><div className="eyebrow"><span className="status-dot" />THE OPEN SOURCE DISCOVERY BOARD</div><h1 id="hero-title">发现正在变热的 <span>GitHub 项目</span></h1><p>追踪增长中的开源项目，寻找值得研究、使用和复刻的新东西。</p><span className="hero-english">Discover what is rising on GitHub.</span></div>
      <div className="hero-radar" aria-hidden="true"><div className="radar-circle outer" /><div className="radar-circle middle" /><div className="radar-circle inner" /><div className="radar-axis x" /><div className="radar-axis y" /><span className="radar-point one" /><span className="radar-point two" /><span className="radar-point three" /><span className="radar-caption">SIGNAL FOUND ↗</span></div>
    </section>
    <section className="discovery-controls" aria-label="搜索与筛选">
      <TranslationControl />
      <SearchBar value={query} onChange={(value) => updateParam('q', value)} />
      <CategoryFilter value={category} source={source} onChange={(value) => updateParam('category', value, '全部')} />
    </section>
    {status === 'fallback' && <div className="source-notice" role="status"><Icon name="info" size={15} />{fallbackReason}</div>}
    <div className="discovery-layout">
      <section className="ranking" aria-labelledby="ranking-title">
        <div className="ranking-heading">
          <div><h2 id="ranking-title"><Icon name="flame" size={21} />{isGithub || loading ? '发现项目' : '热门项目'}<span className="count-pill">{loading ? '…' : filtered.length}</span></h2>
            <p>{loading ? '正在读取本站仓库数据…' : isGithub ? '今日按 Hot / 24h 增长；本周、月按对应增长 / Hot。历史不足项目按活跃窗口筛选后以 Stars 排序。' : '按' + selectedRange.metric + ' Star 增长排序 · 演示数据。'}</p>
          </div>
          <TimeFilter value={range} onChange={(value) => updateParam('range', value, 'today')} />
        </div>
        <div className="results-meta"><span aria-live="polite" role="status">{loading ? '正在加载项目…' : '显示 ' + filtered.length + ' 个项目' + (category !== '全部' ? ' · ' + category : '')}</span><DataSourceStatus /></div>
        {isGithub && <p className="window-note">{growthReady === 0 ? 'RepoRadar 正在积累 Star 历史，约 24 小时后将逐步出现真实增长数据。' : '当前候选池已有 ' + growthReady + ' 个项目具备 ' + selectedRange.metric + ' 真实基准。'}{growthReady < repos.length ? '已有增长项目优先；历史数据仍在积累的项目沿用活跃窗口与 Stars 排序。' : '按真实增长指标排序，统计窗口以数据更新时间为准。'}</p>}
        {loading ? <div className="repo-grid" aria-busy="true" aria-label="正在加载项目">{Array.from({ length: 4 }, (_, i) => <RepoCardSkeleton key={i} />)}</div>
          : error ? <EmptyState icon="info" title="暂时无法读取项目" description="请刷新页面后重试。" />
          : filtered.length ? <div className="repo-grid">{filtered.map((repo, index) => <RepoCard key={repo.id} repo={repo} rank={index + 1} range={range} />)}</div>
          : <EmptyState title="没有找到符合条件的项目" description={isGithub ? '试试其他关键词、分类或更长的时间范围。' : '试试其他关键词或分类。'} reset={() => setParams(isGithub ? { range: 'month' } : {}, { replace: true })} />}
        {filtered.length > 0 && <p className="list-end">已展示全部匹配项目 · 保持好奇，下一个灵感就在这里。</p>}
      </section>
      <aside className="discovery-aside" aria-label="发现提示">
        <div className="aside-panel signal-panel">
          <div className="aside-eyebrow"><Icon name="growth" size={17} />{isMock ? '上升信号' : '候选项目池'}</div>
          <h3>关注增长，而不只是规模。</h3>
          <p>{isMock ? '大项目值得研究，正在变热的小项目，同样值得被看见。' : '同时比较绝对增长与相对增长。Hot 来自透明规则；没有历史基准的项目显示积累中。'}</p>
          {leader && <Link className="signal-link" to={'/repo/' + leader.id}><span>{leader.github.name}<small>{isGithub ? getGrowth(leader, range) === null ? selectedRange.label + '活跃候选 · Stars' : selectedRange.label + '增长信号' : selectedRange.label + '增长领先 · 演示'}</small></span><strong>{isGithub && getGrowth(leader, range) === null ? formatCount(leader.github.stars) : signedGrowth(getGrowth(leader, range))}<Icon name="arrow" size={15} /></strong></Link>}
        </div>
        <div className="aside-panel inspiration-panel">
          <div className="aside-eyebrow"><Icon name="code" size={17} />给独立开发者</div><h3>你的下一个项目，<br />可以从这里开始。</h3><p>看懂一个项目的核心思路，再从一个小而完整的版本开始。</p>
          {!isMock ? <><div className="idea-note"><span>从项目本身开始</span><strong>先了解，再决定。</strong><p>阅读简介与 Topics，检查 License 与维护状态。项目分析将在后续阶段提供。</p></div><Link className="text-link" to="/about">了解阶段计划<Icon name="arrow" size={15} /></Link></>
            : <><div className="idea-note"><span>本期灵感 · Mock</span><strong>可搜索的代码片段工具</strong><p>保存、检索、一键复制。<br />一个人，也能做出好用的工具。</p></div>{inspiration && <Link className="text-link" to={'/repo/' + inspiration.id}>看看怎么做<Icon name="arrow" size={15} /></Link>}</>}
        </div>
        <div className="aside-explainer"><Icon name="info" size={16} /><p>{loading ? '正在读取本站仓库数据，完成后将标识数据来源。' : isMock ? '当前显示演示数据。指标与项目判断均为本地 Mock 内容，并非真实 GitHub 数据。' : 'Phase 3 · GitHub 快照增长与透明 Hot Score。分类来自关键词规则；候选池并非 GitHub Trending。'}<Link to="/about">了解 RepoRadar<Icon name="arrow" size={13} /></Link></p></div>
      </aside>
    </div>
  </main>
}
