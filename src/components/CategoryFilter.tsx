import { categories } from '../types/repo'
import type { Category } from '../types/repo'

export function CategoryFilter({ value, onChange, source }: { value: Category; onChange: (category: Category) => void; source: 'github' | 'mock' | null }) {
  const visible = source !== 'mock' ? categories.filter((category) => category !== '值得复刻' && category !== '一个人能做') : categories
  return <div className="category-filter" role="group" aria-label="项目分类">
    {visible.map((category) => <button key={category} aria-pressed={value === category} className={value === category ? 'selected' : ''} onClick={() => onChange(category)}>{category}</button>)}
  </div>
}
