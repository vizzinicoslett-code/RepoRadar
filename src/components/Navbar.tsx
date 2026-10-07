import { Link, NavLink } from 'react-router-dom'
import { Icon } from './Icon'

export function Navbar() {
  return <header className="site-header">
    <div className="nav-container">
      <Link to="/" className="brand" aria-label="RepoRadar 首页"><span className="brand-mark"><Icon name="radar" size={24} /></span><span>RepoRadar<span className="brand-dot">.</span></span></Link>
      <nav className="main-nav" aria-label="主导航">
        <NavLink to="/" end>发现</NavLink>
        <NavLink to="/favorites">收藏</NavLink>
        <NavLink to="/about">关于</NavLink>
      </nav>
      <div className="nav-end"><span className="preview-label">PREVIEW</span><a className="github-button" href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub<Icon name="external" size={14} /></a></div>
    </div>
  </header>
}
