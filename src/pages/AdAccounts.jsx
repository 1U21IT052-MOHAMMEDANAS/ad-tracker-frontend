import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../api.js'
import { money } from '../format.js'
import { Alert, Empty, Field, Modal, StatusBadge } from '../components/ui.jsx'

const BLANK = { name: '', account_id: '', business_name: '', currency: 'INR', status: 'active', notes: '' }

export default function AdAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null = closed, {} = new, {...} = edit

  const load = useCallback(() => {
    setLoading(true)
    api.get('/ad-accounts')
      .then((r) => setAccounts(r.data))
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  async function remove(account) {
    if (!confirm(`Delete ad account "${account.name}"?`)) return
    try {
      await api.delete(`/ad-accounts/${account.id}`)
      load()
    } catch (e) {
      alert(errorMessage(e))
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Facebook Ad Accounts</h1>
          <p>Meta ad accounts you run campaigns from. Pick one when you add a new ad.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(BLANK)}>+ Add Account</button>
      </header>

      <Alert>{error}</Alert>

      <div className="card">
        {loading ? <Empty>Loading…</Empty> : accounts.length === 0 ? (
          <Empty>No ad accounts yet. Add your first Meta ad account to get started.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Meta Account ID</th>
                  <th>Status</th>
                  <th className="num">Ads</th>
                  <th className="num">Funds Added</th>
                  <th className="num">Allocated to Ads</th>
                  <th className="num">Spent</th>
                  <th className="num">Balance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.name}</strong>
                      {a.business_name && <div className="muted">{a.business_name}</div>}
                    </td>
                    <td className="mono">{a.account_id || '—'}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="num">{a.ads_count}</td>
                    <td className="num">{money(a.funds_added, a.currency)}</td>
                    <td className="num">{money(a.fund_allocated, a.currency)}</td>
                    <td className="num">{money(a.total_spent, a.currency)}</td>
                    <td className={`num ${a.balance < 0 ? 'neg' : 'pos'}`}>{money(a.balance, a.currency)}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => setEditing(a)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(a)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <AccountForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </>
  )
}

function AccountForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ ...BLANK, ...initial })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (initial.id) await api.put(`/ad-accounts/${initial.id}`, form)
      else await api.post('/ad-accounts', form)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={initial.id ? 'Edit Ad Account' : 'Add Ad Account'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Alert>{error}</Alert>
        <Field label="Account name *">
          <input value={form.name} onChange={set('name')} required autoFocus />
        </Field>
        <div className="grid-2">
          <Field label="Meta ad account ID" hint="e.g. act_1234567890">
            <input value={form.account_id ?? ''} onChange={set('account_id')} />
          </Field>
          <Field label="Business / page name">
            <input value={form.business_name ?? ''} onChange={set('business_name')} />
          </Field>
          <Field label="Currency *">
            <select value={form.currency} onChange={set('currency')}>
              {['INR', 'USD', 'AED', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Status *">
            <select value={form.status} onChange={set('status')}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </Field>
        </div>
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
