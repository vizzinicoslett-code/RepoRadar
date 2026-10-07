import { useEffect } from 'react'
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { TranslationProvider } from './components/TranslationProvider'
import { RepoProvider } from './components/RepoProvider'
import { Home } from './pages/Home'
import { RepoDetail } from './pages/RepoDetail'
import { Favorites } from './pages/Favorites'
import { About } from './pages/About'
import { NotFound } from './pages/NotFound'

function RouteEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    const name = pathname.startsWith('/repo/') ? '项目详情' : pathname === '/favorites' ? '收藏' : pathname === '/about' ? '关于' : pathname === '/' ? '发现开源新灵感' : '页面未找到'
    document.title = `RepoRadar · ${name}`
  }, [pathname])
  return null
}

export function App() {
  return <RepoProvider><TranslationProvider><HashRouter><RouteEffects /><a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>跳转到内容</a><Navbar /><Routes><Route path="/" element={<Home />} /><Route path="/repo/:id" element={<RepoDetail />} /><Route path="/favorites" element={<Favorites />} /><Route path="/about" element={<About />} /><Route path="*" element={<NotFound />} /></Routes><footer className="site-footer container"><span>RepoRadar<span className="brand-dot">.</span><small>为好奇的开发者而造。</small></span><span className="footer-right">Phase 3 · Growth & Translation<Link to="/about">关于项目</Link></span></footer></HashRouter></TranslationProvider></RepoProvider>
}
