import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../api.js'
import { date, money, num } from '../format.js'
import { Alert, Empty, Stat, StatusBadge } from '../components/ui.jsx'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get('/dashboard'), api.get('/ad-accounts')])
      .then(([d, a]) => { setData(d.data); setAccounts(a.data) })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  if (error) return <Alert>{error}. Is the Laravel server running?</Alert>
  if (!data) return <Empty>Loading…</Empty>

  // Totals mix accounts; show in the first account's currency (most setups use one).
  const cur = accounts[0]?.currency || 'INR'
  const days = [...data.last_14_days].reverse()

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            {data.accounts} ad account{data.accounts === 1 ? '' : 's'} · {data.ads_total} ads
            {Object.entries(data.ads_by_status).map(([s, c]) => ` · ${c} ${s}`)}
          </p>
        </div>
        <Link to="/daily-update" className="btn btn-primary">Enter today’s numbers</Link>
      </header>

      <div className="stats">
        <Stat label="Funds added" value={money(data.funds_added, cur)} />
        <Stat label="Allocated to ads" value={money(data.fund_allocated, cur)} />
        <Stat label="Amount spent" value={money(data.total_spent, cur)} />
        <Stat label="Balance" value={money(data.balance, cur)} tone={data.balance < 0 ? 'neg' : 'pos'} />
        <Stat label="Results" value={num(data.total_results)} />
        <Stat label="Cost per result" value={money(data.cost_per_result, cur)} />
      </div>

      <div className="grid-dash">
        <div className="card">
          <h3 className="card-title">Top ads by spend</h3>
          {data.top_ads.length === 0 ? <Empty>No ads yet.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Status</th>
                    <th className="num">Results</th>
                    <th className="num">Cost / Result</th>
                    <th className="num">Spent</th>
                    <th className="num">Fund Left</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_ads.map((ad) => (
                    <tr key={ad.id}>
                      <td>
                        <Link className="link" to={`/ads/${ad.id}`}><strong>{ad.campaign_name}</strong></Link>
                        <div className="muted">{ad.ad_account?.name}</div>
                      </td>
                      <td><StatusBadge status={ad.status} /></td>
                      <td className="num">{num(ad.total_results)}</td>
                      <td className="num">{money(ad.cost_per_result, ad.ad_account?.currency)}</td>
                      <td className="num">{money(ad.total_spent, ad.ad_account?.currency)}</td>
                      <td className={`num ${ad.fund_remaining < 0 ? 'neg' : 'pos'}`}>{money(ad.fund_remaining, ad.ad_account?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">Last 14 days</h3>
          {days.length === 0 ? <Empty>No daily data in the last 14 days.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="num">Results</th>
                    <th className="num">Impressions</th>
                    <th className="num">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.stat_date}>
                      <td>{date(d.stat_date)}</td>
                      <td className="num">{num(d.results)}</td>
                      <td className="num">{num(d.impressions)}</td>
                      <td className="num">{money(d.spent, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Ad account balances</h3>
        {accounts.length === 0 ? <Empty>No ad accounts. <Link className="link" to="/ad-accounts">Add one</Link>.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="num">Ads</th>
                  <th className="num">Funds Added</th>
                  <th className="num">Spent</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong> <span className="muted mono">{a.account_id}</span></td>
                    <td className="num">{a.ads_count}</td>
                    <td className="num">{money(a.funds_added, a.currency)}</td>
                    <td className="num">{money(a.total_spent, a.currency)}</td>
                    <td className={`num ${a.balance < 0 ? 'neg' : 'pos'}`}>{money(a.balance, a.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
