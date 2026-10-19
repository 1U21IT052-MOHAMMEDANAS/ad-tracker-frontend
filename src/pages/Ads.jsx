import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { errorMessage } from '../api.js'
import { AD_STATUSES, date, money, num, today } from '../format.js'
import { Alert, Empty, Field, Modal, StatusBadge } from '../components/ui.jsx'

export default function Ads() {
  const [accounts, setAccounts] = useState([])
  const [ads, setAds] = useState([])
  const [filters, setFilters] = useState({ ad_account_id: '', status: '', search: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    api.get('/ad-accounts').then((r) => setAccounts(r.data)).catch((e) => setError(errorMessage(e)))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/ads', { params: filters })
      .then((r) => setAds(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  async function remove(ad) {
    if (!confirm(`Delete "${ad.campaign_name}" and all its daily data?`)) return
    try {
      await api.delete(`/ads/${ad.id}`)
      load()
    } catch (e) {
      alert(errorMessage(e))
    }
  }

  const setFilter = (k) => (e) => setFilters({ ...filters, [k]: e.target.value })

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Ads</h1>
          <p>Every Meta campaign with totals from its daily updates.</p>
        </div>
        <button
          className="btn btn-primary"
          disabled={!accounts.length}
          title={accounts.length ? '' : 'Add an ad account first'}
          onClick={() => setEditing({})}
        >
          + Add Ad
        </button>
      </header>

      <Alert>{error}</Alert>
      {!accounts.length && !loading && (
        <div className="notice">Add a Facebook ad account first (Ad Accounts tab). Then you can add ads.</div>
      )}

      <div className="toolbar">
        <input placeholder="Search campaign…" value={filters.search} onChange={setFilter('search')} />
        <select value={filters.ad_account_id} onChange={setFilter('ad_account_id')}>
          <option value="">All ad accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filters.status} onChange={setFilter('status')}>
          <option value="">All statuses</option>
          {AD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card">
        {loading && !ads.length ? <Empty>Loading…</Empty> : ads.length === 0 ? <Empty>No ads found.</Empty> : (
          <div className="table-wrap">
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => {
                  const cur = ad.ad_account?.currency
                  return (
                    <tr key={ad.id}>
                      <td>
                        <Link to={`/ads/${ad.id}`} className="link"><strong>{ad.campaign_name}</strong></Link>
                        <div className="muted">{ad.ad_account?.name}</div>
                      </td>
                      <td><StatusBadge status={ad.status} /></td>
                      <td className="nowrap">
                        {date(ad.start_date)} – {date(ad.end_date)}
                        <div className="muted">Last update: {date(ad.last_updated)}</div>
                      </td>
                      <td className="num">{money(ad.budget, cur)}<div className="muted">{ad.budget_type}</div></td>
                      <td className="num">{num(ad.total_results)}</td>
                      <td className="num">{num(ad.total_impressions)}</td>
                      <td className="num">{num(ad.total_reach)}</td>
                      <td className="num">{money(ad.cost_per_result, cur)}</td>
                      <td className="num">{money(ad.total_spent, cur)}</td>
                      <td className="num">{money(ad.fund_amount, cur)}</td>
                      <td className={`num ${ad.fund_remaining < 0 ? 'neg' : 'pos'}`}>{money(ad.fund_remaining, cur)}</td>
                      <td className="actions">
                        <Link className="btn btn-sm" to={`/ads/${ad.id}`}>Daily</Link>
                        <button className="btn btn-sm" onClick={() => setEditing(ad)}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => remove(ad)}>Delete</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <AdForm
          initial={editing}
          accounts={accounts}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </>
  )
}

export function AdForm({ initial, accounts, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    ad_account_id: accounts.find((a) => a.status === 'active')?.id || '',
    campaign_name: '',
    objective: '',
    status: 'active',
    start_date: today(),
    end_date: today(),
    budget: '',
    budget_type: 'daily',
    fund_amount: '',
    notes: '',
    ...initial,
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // New ads can only use active accounts; when editing keep the current account selectable.
  const options = accounts.filter((a) => a.status === 'active' || String(a.id) === String(initial.ad_account_id))

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      budget: form.budget === '' ? 0 : form.budget,
      fund_amount: form.fund_amount === '' ? 0 : form.fund_amount,
    }
    try {
      if (initial.id) await api.put(`/ads/${initial.id}`, payload)
      else await api.post('/ads', payload)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={initial.id ? 'Edit Ad' : 'Add New Ad'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Alert>{error}</Alert>
        <Field label="Facebook ad account *">
          <select value={form.ad_account_id} onChange={set('ad_account_id')} required>
            <option value="">Select account</option>
            {options.map((a) => <option key={a.id} value={a.id}>{a.name}{a.account_id ? ` (${a.account_id})` : ''}</option>)}
          </select>
        </Field>
        <Field label="Campaign name *">
          <input value={form.campaign_name} onChange={set('campaign_name')} required autoFocus />
        </Field>
        <div className="grid-2">
          <Field label="Objective" hint="e.g. Leads, Sales, Traffic">
            <input value={form.objective ?? ''} onChange={set('objective')} />
          </Field>
          <Field label="Status *">
            <select value={form.status} onChange={set('status')}>
              {AD_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Start date *">
            <input type="date" value={form.start_date} onChange={set('start_date')} required />
          </Field>
          <Field label="End date *">
            <input type="date" value={form.end_date} min={form.start_date} onChange={set('end_date')} required />
          </Field>
          <Field label="Budget *">
            <input type="number" step="0.01" min="0" value={form.budget} onChange={set('budget')} required />
          </Field>
          <Field label="Budget type">
            <select value={form.budget_type} onChange={set('budget_type')}>
              <option value="daily">daily</option>
              <option value="lifetime">lifetime</option>
            </select>
          </Field>
        </div>
        <Field label="Fund allocated to this ad *" hint="How much of the account's funds is set aside for this ad.">
          <input type="number" step="0.01" min="0" value={form.fund_amount} onChange={set('fund_amount')} required />
        </Field>
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
