import type { CSSProperties, ReactNode } from 'react'

export type IconName = 'radar' | 'search' | 'arrow' | 'external' | 'star' | 'fork' | 'growth' | 'flame' | 'code' | 'bookmark' | 'close' | 'back' | 'info' | 'check'

const paths: Record<IconName, ReactNode> = {
  radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><path d="m12 12 6.5-6.5" /><circle cx="16" cy="16" r="1.2" fill="currentColor" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  arrow: <><path d="M5 12h14m-5-5 5 5-5 5" /></>,
  external: <><path d="M14 4h6v6m0-6L10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
  star: <path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4-5.7-3-5.7 3 1.1-6.4-4.6-4.5 6.4-.9Z" />,
  fork: <><circle cx="6" cy="5" r="2" /><circle cx="18" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><path d="M6 7v10m12-10v2a3 3 0 0 1-3 3H6" /></>,
  growth: <path d="m3 17 6-6 4 4 8-10m-6 0h6v6" />,
  flame: <path d="M13 3c1 5-4 6-3 10 2-1 3-3 3-5 3 2 6 5 6 8a7 7 0 0 1-14 0c0-4 3-6 4-8 0 3 1 4 2 4-1-4 1-6 2-9Z" />,
  code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18" /></>,
  bookmark: <path d="M6 3h12v18l-6-4-6 4Z" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  back: <path d="M19 12H5m5-5-5 5 5 5" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
}

export function Icon({ name, size = 18, style, className = '' }: { name: IconName; size?: number; style?: CSSProperties; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>
}
