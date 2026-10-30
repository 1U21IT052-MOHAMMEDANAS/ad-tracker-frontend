import { NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import Ads from './pages/Ads.jsx'
import AdDetail from './pages/AdDetail.jsx'
import DailyUpdate from './pages/DailyUpdate.jsx'
import Funds from './pages/Funds.jsx'
import AdAccounts from './pages/AdAccounts.jsx'
import MetaAds from './pages/MetaAds.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/meta-ads', label: 'Meta Ads (Live)' },
  { to: '/ads', label: 'Ads' },
  { to: '/daily-update', label: 'Daily Update' },
  { to: '/funds', label: 'Funds' },
  { to: '/ad-accounts', label: 'Ad Accounts' },
]

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">S&amp;M</span>
          <div>
            <strong>Sales &amp; Marketing</strong>
            <small>Meta Ads tracker</small>
          </div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/meta-ads" element={<MetaAds />} />
          <Route path="/ads" element={<Ads />} />
          <Route path="/ads/:id" element={<AdDetail />} />
          <Route path="/daily-update" element={<DailyUpdate />} />
          <Route path="/funds" element={<Funds />} />
          <Route path="/ad-accounts" element={<AdAccounts />} />
        </Routes>
      </main>
    </div>
  )
}
