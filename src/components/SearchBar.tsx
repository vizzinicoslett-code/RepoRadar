import { useRef } from 'react'
import { Icon } from './Icon'

export function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return <div className="search-bar">
    <Icon name="search" size={21} />
    <label className="sr-only" htmlFor="repo-search">搜索项目、语言或关键词</label>
    <input ref={input} id="repo-search" type="search" placeholder="搜索项目、语言或关键词..." value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" />
    {value ? <button className="icon-button" aria-label="清空搜索" onClick={() => { onChange(''); input.current?.focus() }}><Icon name="close" /></button> : <span className="search-hint">寻找下一个灵感</span>}
  </div>
}
