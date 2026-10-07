import { Link } from 'react-router-dom'
import { Icon } from './Icon'
import type { IconName } from './Icon'

export function EmptyState({ icon = 'search', title, description, reset }: { icon?: IconName; title: string; description: string; reset?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={28} /></span><h2>{title}</h2><p>{description}</p>{reset ? <button className="button button-primary" onClick={reset}>重置筛选<Icon name="arrow" size={16} /></button> : <Link className="button button-primary" to="/">返回发现<Icon name="arrow" size={16} /></Link>}</div>
}
