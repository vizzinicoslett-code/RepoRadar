import { discoveryCategories } from '../types/repo'
import type { Category } from '../types/repo'

export function CategoryFilter({ value, onChange }: { value: Category; onChange: (category: Category) => void }) {
  return <div className="category-filter" role="group" aria-label="项目分类">
    {discoveryCategories.map((category) => <button key={category} aria-pressed={value === category} className={value === category ? 'selected' : ''} onClick={() => onChange(category)}>{category}</button>)}
  </div>
}
