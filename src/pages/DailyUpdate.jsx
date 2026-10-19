import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../api.js'
import { AD_STATUSES, date, money, today } from '../format.js'
import { Alert, Empty } from '../components/ui.jsx'

const METRICS = ['results', 'impressions', 'reach', 'amount_spent']

/** One sheet to enter today's numbers for every ad running on the chosen date. */
export default function DailyUpdate() {
  const [day, setDay] = useState(today())
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.get('/ad-accounts').then((r) => setAccounts(r.data))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setMessage('')
    api.get('/daily-stats', { params: { date: day, ad_account_id: accountId || undefined } })
      .then((r) => setRows(r.data.map(({ ad, stat }) => ({
        ad,
        exists: !!stat,
        dirty: false,
        values: {
          results: stat?.results ?? '',
          impressions: stat?.impressions ?? '',
          reach: stat?.reach ?? '',
          amount_spent: stat?.amount_spent ?? '',
          status: ad.status,
        },
      }))))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [day, accountId])

  useEffect(load, [load])

  function change(i, key, value) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, dirty: true, values: { ...r.values, [key]: value } } : r)))
  }

  const toSave = rows.filter((r) => r.dirty && METRICS.some((k) => r.values[k] !== ''))

  async function saveAll() {
    setSaving(true)
    setError('')
    try {
      await api.post('/daily-stats/bulk', {
        entries: toSave.map((r) => ({
          ad_id: r.ad.id,
          stat_date: day,
          ...Object.fromEntries(METRICS.map((k) => [k, r.values[k] === '' ? 0 : r.values[k]])),
          status: r.values.status,
        })),
      })
      setMessage(`Saved ${toSave.length} ad${toSave.length === 1 ? '' : 's'} for ${date(day)}.`)
      load()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Daily Update</h1>
          <p>Enter each ad’s numbers for one day from Meta Ads Manager. Only ads running on that date are listed.</p>
        </div>
        <button className="btn btn-primary" onClick={saveAll} disabled={saving || toSave.length === 0}>
          {saving ? 'Saving…' : `Save ${toSave.length || ''} change${toSave.length === 1 ? '' : 's'}`}
        </button>
      </header>

      <Alert>{error}</Alert>
      {message && <div className="success">{message}</div>}

      <div className="toolbar">
        <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">All ad accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? <Empty>Loading…</Empty> : rows.length === 0 ? (
          <Empty>No ads are scheduled on {date(day)}. Check each ad’s start and end dates.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="sheet">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th className="num">Results</th>
                  <th className="num">Impressions</th>
                  <th className="num">Reach</th>
                  <th className="num">Amount Spent</th>
                  <th className="num">Cost / Result</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const v = r.values
                  const cpr = Number(v.results) > 0 ? Number(v.amount_spent || 0) / Number(v.results) : null
                  return (
                    <tr key={r.ad.id} className={r.dirty ? 'row-dirty' : ''}>
                      <td>
                        <Link to={`/ads/${r.ad.id}`} className="link"><strong>{r.ad.campaign_name}</strong></Link>
                        <div className="muted">{r.ad.ad_account?.name} · budget {money(r.ad.budget, r.ad.ad_account?.currency)}/{r.ad.budget_type === 'daily' ? 'day' : 'total'}</div>
                      </td>
                      <td>
                        <select value={v.status} onChange={(e) => change(i, 'status', e.target.value)}>
                          {AD_STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      {METRICS.map((k) => (
                        <td key={k} className="num">
                          <input
                            type="number"
                            min="0"
                            step={k === 'amount_spent' ? '0.01' : '1'}
                            value={v[k]}
                            onChange={(e) => change(i, k, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="num">{cpr === null ? '—' : money(cpr, r.ad.ad_account?.currency)}</td>
                      <td>{r.exists && !r.dirty && <span className="tick" title="Already entered">✓</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
