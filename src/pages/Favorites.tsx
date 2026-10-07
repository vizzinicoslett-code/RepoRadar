import { EmptyState } from '../components/EmptyState'

export function Favorites() {
  return <main id="main-content" tabIndex={-1} className="container secondary-page"><div className="page-heading"><span className="eyebrow">YOUR COLLECTION</span><h1>收藏灵感，留给下一次出发。</h1><p>把值得研究的项目放在一起。</p></div><div className="placeholder-panel"><EmptyState icon="bookmark" title="收藏功能正在计划中" description="当前专注发现与项目展示。你可以浏览项目，并通过详情页打开 GitHub 仓库。" /></div></main>
}
