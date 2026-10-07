import { EmptyState } from '../components/EmptyState'

export function NotFound() {
  return <main id="main-content" tabIndex={-1} className="container secondary-page"><EmptyState icon="radar" title="页面不在雷达范围内" description="检查地址，或返回发现页继续探索。" /></main>
}
