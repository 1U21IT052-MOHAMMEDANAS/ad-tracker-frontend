import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api, { errorMessage } from '../api.js'
import { AD_STATUSES, date, money, num, today } from '../format.js'
import { Alert, Empty, Field, Modal, Stat, StatusBadge } from '../components/ui.jsx'
import { AdForm } from './Ads.jsx'

export default function AdDetail() {
  const { id } = useParams()
  const [ad, setAd] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState('')
  const [editingStat, setEditingStat] = useState(null)
  const [editingAd, setEditingAd] = useState(false)

  const load = useCallback(() => {
    api.get(`/ads/${id}`).then((r) => setAd(r.data)).catch((e) => setError(errorMessage(e)))
  }, [id])

  useEffect(load, [load])
  useEffect(() => {
    api.get('/ad-accounts').then((r) => setAccounts(r.data))
  }, [])

  async function removeStat(stat) {
    if (!confirm(`Delete the entry for ${date(stat.stat_date)}?`)) return
    try {
      await api.delete(`/daily-stats/${stat.id}`)
      load()
    } catch (e) {
      alert(errorMessage(e))
    }
  }

  if (error) return <Alert>{error}</Alert>
  if (!ad) return <Empty>Loading…</Empty>

  const cur = ad.ad_account?.currency
  const usedPct = ad.fund_amount > 0 ? Math.min(100, (ad.total_spent / ad.fund_amount) * 100) : 0

  return (
    <>
      <Link to="/ads" className="back">← All ads</Link>
      <header className="page-head">
        <div>
          <h1>{ad.campaign_name} <StatusBadge status={ad.status} /></h1>
          <p>
            {ad.ad_account?.name} · {date(ad.start_date)} – {date(ad.end_date)} · Budget {money(ad.budget, cur)} ({ad.budget_type})
            {ad.objective && <> · {ad.objective}</>}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => setEditingAd(true)}>Edit Ad</button>
          <button className="btn btn-primary" onClick={() => setEditingStat({ stat_date: today(), status: ad.status })}>
            + Daily Update
          </button>
        </div>
      </header>

      <div className="stats">
        <Stat label="Results" value={num(ad.total_results)} />
        <Stat label="Impressions" value={num(ad.total_impressions)} />
        <Stat label="Reach" value={num(ad.total_reach)} />
        <Stat label="Cost per result" value={money(ad.cost_per_result, cur)} />
        <Stat label="Amount spent" value={money(ad.total_spent, cur)} />
        <Stat label="Fund left" value={money(ad.fund_remaining, cur)} tone={ad.fund_remaining < 0 ? 'neg' : 'pos'} />
      </div>

      <div className="card">
        <div className="fund-bar-head">
          <span>Fund used: {money(ad.total_spent, cur)} of {money(ad.fund_amount, cur)}</span>
          <span>{usedPct.toFixed(0)}%</span>
        </div>
        <div className="fund-bar"><div style={{ width: `${usedPct}%` }} className={usedPct >= 90 ? 'warn' : ''} /></div>
      </div>

      <div className="card">
        <h3 className="card-title">Daily performance</h3>
        {ad.daily_stats.length === 0 ? <Empty>No daily data yet. Click “+ Daily Update” to add today’s numbers.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Results</th>
                  <th className="num">Impressions</th>
                  <th className="num">Reach</th>
                  <th className="num">Cost / Result</th>
                  <th className="num">Amount Spent</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ad.daily_stats.map((s) => (
                  <tr key={s.id}>
                    <td className="nowrap">{date(s.stat_date)}</td>
                    <td className="num">{num(s.results)}</td>
                    <td className="num">{num(s.impressions)}</td>
                    <td className="num">{num(s.reach)}</td>
                    <td className="num">{money(s.cost_per_result, cur)}</td>
                    <td className="num">{money(s.amount_spent, cur)}</td>
                    <td className="muted">{s.notes || ''}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => setEditingStat(s)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => removeStat(s)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">
          Total reach adds up daily reach, so it can count the same person more than once. Check Meta Ads Manager for unique reach.
        </p>
      </div>

      {editingStat && (
        <StatForm
          ad={ad}
          initial={editingStat}
          onClose={() => setEditingStat(null)}
          onSaved={() => { setEditingStat(null); load() }}
        />
      )}
      {editingAd && (
        <AdForm
          initial={ad}
          accounts={accounts}
          onClose={() => setEditingAd(false)}
          onSaved={() => { setEditingAd(false); load() }}
        />
      )}
    </>
  )
}

function StatForm({ ad, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    results: '', impressions: '', reach: '', amount_spent: '', notes: '', status: ad.status,
    ...initial,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const cpr = Number(form.results) > 0 ? Number(form.amount_spent || 0) / Number(form.results) : null

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ad_id: ad.id,
      stat_date: form.stat_date,
      results: form.results || 0,
      impressions: form.impressions || 0,
      reach: form.reach || 0,
      amount_spent: form.amount_spent || 0,
      notes: form.notes,
      status: form.status,
    }
    try {
      if (initial.id) await api.put(`/daily-stats/${initial.id}`, payload)
      else await api.post('/daily-stats', payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={initial.id ? `Edit ${date(initial.stat_date)}` : 'Daily Update'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Alert>{error}</Alert>
        <div className="grid-2">
          <Field label="Date *" hint={initial.id ? '' : 'If this date already has data, it will be replaced.'}>
            <input type="date" value={form.stat_date} min={ad.start_date} max={ad.end_date} onChange={set('stat_date')} required />
          </Field>
          <Field label="Campaign status">
            <select value={form.status} onChange={set('status')}>
              {AD_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Results">
            <input type="number" min="0" value={form.results} onChange={set('results')} autoFocus />
          </Field>
          <Field label="Amount spent">
            <input type="number" min="0" step="0.01" value={form.amount_spent} onChange={set('amount_spent')} />
          </Field>
          <Field label="Impressions">
            <input type="number" min="0" value={form.impressions} onChange={set('impressions')} />
          </Field>
          <Field label="Reach">
            <input type="number" min="0" value={form.reach} onChange={set('reach')} />
          </Field>
        </div>
        <div className="calc">Cost per result: <strong>{cpr === null ? '—' : money(cpr, ad.ad_account?.currency)}</strong> <span className="muted">(calculated)</span></div>
        <Field label="Notes">
          <textarea rows={2} value={form.notes ?? ''} onChange={set('notes')} />
        </Field>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
