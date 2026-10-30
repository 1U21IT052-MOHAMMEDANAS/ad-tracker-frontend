import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { errorMessage } from '../api.js'
import { date, money, num, today } from '../format.js'
import { Alert, Empty } from '../components/ui.jsx'

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7d', label: 'Last 7 days' },
  { value: 'last_30d', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'maximum', label: 'Lifetime' },
  { value: 'custom', label: 'Custom range…' },
]

// The page re-reads the database this often; the backend pulls from Meta every 15 minutes.
const REFRESH_MS = 60_000

export default function MetaAds() {
  const [range, setRange] = useState('last_30d')
  const [custom, setCustom] = useState({ since: '', until: today() })
  const [filters, setFilters] = useState({ account: '', status: '', search: '' })
  const [data, setData] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const customReady = range !== 'custom' || (custom.since && custom.until && custom.since <= custom.until)

  const load = useCallback((quiet = false) => {
    if (!customReady) return
    if (!quiet) setLoading(true)
    const params = range === 'custom' ? { range, ...custom } : { range }
    api.get('/meta/campaigns', { params })
      .then((r) => { setData(r.data); setError('') })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [range, custom, customReady])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    api.get('/meta/status').then((r) => setToken(r.data)).catch(() => {})
  }, [])

  async function syncNow() {
    setSyncing(true)
    setError('')
    try {
      const r = await api.post('/meta/sync')
      if (r.data.errors?.length) setError(r.data.errors.join(' '))
      load(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSyncing(false)
    }
  }

  const campaigns = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return (data?.campaigns ?? []).filter((c) =>
      (!filters.account || String(c.account.id) === filters.account)
      && (!filters.status || statusGroup(c.status) === filters.status)
      && (!q || c.name.toLowerCase().includes(q)))
  }, [data, filters])

  const totals = useMemo(() => {
    const types = new Set(campaigns.filter((c) => c.results).map((c) => c.result_type))
    const results = campaigns.reduce((s, c) => s + (c.results || 0), 0)
    const spend = campaigns.reduce((s, c) => s + c.spend, 0)
    return {
      spend,
      impressions: campaigns.reduce((s, c) => s + c.impressions, 0),
      // Only add up results when they're the same kind (e.g. all messaging conversations).
      results: types.size === 1 ? results : null,
      resultType: types.size === 1 ? [...types][0] : null,
      costPerResult: types.size === 1 && results ? spend / results : null,
    }
  }, [campaigns])

  const setFilter = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })
  const accounts = data?.accounts ?? []

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Meta Ads <span className="live-dot" title="Live from Meta" /></h1>
          <p>
            Live from your Meta ad accounts · updates every 15 minutes
            {data?.last_synced_at && <> · last synced {ago(data.last_synced_at)}</>}
          </p>
        </div>
        <button className="btn btn-primary" onClick={syncNow} disabled={syncing}>
          {syncing ? 'Syncing…' : '↻ Sync now'}
        </button>
      </header>

      <TokenNotice token={token} />
      <Alert>{error || data?.warning}</Alert>

      {accounts.length > 0 && (
        <div className="stats">
          {accounts.map((a) => {
            const activeBudget = (data.campaigns ?? [])
              .filter((c) => c.account.id === a.id && c.status === 'active' && c.budget_type === 'daily')
              .reduce((s, c) => s + c.budget, 0)
            const low = a.fund_left !== null && a.fund_left < activeBudget
            return (
              <div key={a.id} className={`stat account-card ${low ? 'stat-neg' : ''}`}>
                <div className="stat-label">{a.name} <span className="mono">{a.account_id.replace('act_', '')}</span></div>
                <div className="stat-value">{money(a.fund_left, a.currency)}</div>
                <div className="muted">
                  Fund left of {money(a.fund, a.currency)}
                  {a.status_label !== 'active' && <> · <strong>{a.status_label}</strong></>}
                </div>
                {low && <div className="muted neg">Less than today's active budget ({money(activeBudget, a.currency)})</div>}
              </div>
            )
          })}
          <div className="stat">
            <div className="stat-label">Amount spent</div>
            <div className="stat-value">{money(totals.spend)}</div>
            <div className="muted">{RANGES.find((r) => r.value === range)?.label}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Results</div>
            <div className="stat-value">{totals.results === null ? '—' : num(totals.results)}</div>
            <div className="muted">
              {totals.costPerResult ? `${money(totals.costPerResult)} per result` : 'Mixed result types'}
            </div>
          </div>
        </div>
      )}

      <div className="toolbar">
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {range === 'custom' && (
          <>
            <input type="date" value={custom.since} max={custom.until || today()} onChange={(e) => setCustom({ ...custom, since: e.target.value })} />
            <input type="date" value={custom.until} min={custom.since} max={today()} onChange={(e) => setCustom({ ...custom, until: e.target.value })} />
          </>
        )}
        <select value={filters.account} onChange={setFilter('account')}>
          <option value="">All ad accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filters.status} onChange={setFilter('status')}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Off / paused</option>
          <option value="other">Other (review, issues…)</option>
        </select>
        <input placeholder="Search campaign…" value={filters.search} onChange={setFilter('search')} />
      </div>

      <div className="card">
        {range === 'custom' && !customReady ? <Empty>Pick a start and end date.</Empty>
          : loading && !data ? <Empty>Loading…</Empty>
            : !accounts.length ? <Empty>No data yet. Click “Sync now” to pull your ad accounts from Meta.</Empty>
              : campaigns.length === 0 ? <Empty>No campaigns match these filters.</Empty> : (
                <div className={`table-wrap ${loading ? 'is-loading' : ''}`}>
                  <table>
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Status</th>
                        <th>Schedule</th>
                        <th className="num">Budget</th>
                        <th className="num">Results</th>
                        <th className="num">Impressions</th>
                        <th className="num">Reach</th>
                        <th className="num">Cost / Result</th>
                        <th className="num">Amount Spent</th>
                        <th className="num">Fund</th>
                        <th className="num">Fund Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c) => {
                        const cur = c.account.currency
                        return (
                          <tr key={c.id}>
                            <td>
                              <a
                                className="link"
                                href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${c.account.account_id.replace('act_', '')}&selected_campaign_ids=${c.campaign_id}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Open in Ads Manager"
                              >
                                <strong>{c.name}</strong>
                              </a>
                              <div className="muted">{c.account.name}</div>
                            </td>
                            <td><span className={`badge badge-${statusGroup(c.status)}`}>{c.status.replace(/_/g, ' ')}</span></td>
                            <td className="nowrap">
                              {date(c.start_time)} – {c.stop_time ? date(c.stop_time) : 'Ongoing'}
                            </td>
                            <td className="num">
                              {money(c.budget, cur)}
                              <div className="muted">
                                {c.budget_type ?? 'no budget'}{c.budget_level === 'ad_set' ? ' · ad sets' : ''}
                              </div>
                            </td>
                            <td className="num">
                              {num(c.results)}
                              {c.result_type && <div className="muted">{c.result_type}</div>}
                            </td>
                            <td className="num">{num(c.impressions)}</td>
                            <td className="num">{num(c.reach)}</td>
                            <td className="num">{money(c.cost_per_result, cur)}</td>
                            <td className="num">{money(c.spend, cur)}</td>
                            <td className="num">{money(c.fund, cur)}</td>
                            <td className={`num ${c.fund_left !== null && c.fund_left < 100 ? 'neg' : 'pos'}`}>{money(c.fund_left, cur)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4}><strong>Total · {campaigns.length} campaigns</strong></td>
                        <td className="num">
                          {totals.results === null ? '—' : num(totals.results)}
                          {totals.resultType && <div className="muted">{totals.resultType}</div>}
                        </td>
                        <td className="num">{num(totals.impressions)}</td>
                        <td className="num muted">—</td>
                        <td className="num">{money(totals.costPerResult)}</td>
                        <td className="num"><strong>{money(totals.spend)}</strong></td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                  <p className="muted small">
                    Fund and Fund Left are per ad account. Reach is unique people, so it isn't added up.
                    Click a campaign name to open it in Ads Manager.
                  </p>
                </div>
              )}
      </div>
    </>
  )
}

function TokenNotice({ token }) {
  if (!token) return null
  if (!token.configured) {
    return <div className="alert">Meta isn't connected. Add META_APP_ID, META_APP_SECRET and META_ACCESS_TOKEN to backend/.env.</div>
  }
  if (token.valid === false && /blocked|cannot call api/i.test(token.error ?? '')) {
    return (
      <div className="alert">
        Meta has blocked API access for this app or account ({token.error}). Open developers.facebook.com and
        facebook.com/accountquality to see what Meta needs verified. The token itself doesn't need changing.
      </div>
    )
  }
  if (token.valid === false) {
    return <div className="alert">The Meta access token has expired or is invalid. Generate a new one and update META_ACCESS_TOKEN in backend/.env. {token.error}</div>
  }
  if (token.days_left !== undefined && token.days_left <= 10) {
    return (
      <div className="notice">
        The Meta access token expires in <strong>{token.days_left} days</strong> ({date(token.expires_at)}).
        Renew it in Graph API Explorer → Extend Access Token, then update backend/.env.
      </div>
    )
  }
  return null
}

function statusGroup(status) {
  if (status === 'active') return 'active'
  if (status.includes('paused')) return 'paused'
  return 'other'
}

function ago(value) {
  const mins = Math.round((Date.now() - new Date(value)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return hours < 24 ? `${hours} h ago` : date(value)
}
