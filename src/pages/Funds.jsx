import { useCallback, useEffect, useState } from 'react'
import api, { errorMessage } from '../api.js'
import { date, money, today } from '../format.js'
import { Alert, Empty, Field, Modal } from '../components/ui.jsx'

export default function Funds() {
  const [accounts, setAccounts] = useState([])
  const [funds, setFunds] = useState([])
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/ad-accounts'),
      api.get('/funds', { params: { ad_account_id: accountId || undefined } }),
    ])
      .then(([a, f]) => { setAccounts(a.data); setFunds(f.data) })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false))
  }, [accountId])

  useEffect(load, [load])

  async function remove(fund) {
    if (!confirm(`Delete fund entry of ${money(fund.amount, fund.ad_account?.currency)}?`)) return
    try {
      await api.delete(`/funds/${fund.id}`)
      load()
    } catch (e) {
      alert(errorMessage(e))
    }
  }

  const shownAccounts = accountId ? accounts.filter((a) => String(a.id) === String(accountId)) : accounts

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Funds</h1>
          <p>Money added to each ad account, how much is set aside for ads, and what is left.</p>
        </div>
        <button className="btn btn-primary" disabled={!accounts.length} onClick={() => setEditing({})}>+ Add Fund</button>
      </header>

      <Alert>{error}</Alert>

      <div className="toolbar">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">All ad accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="card">
        <h3 className="card-title">Balance by account</h3>
        {shownAccounts.length === 0 ? <Empty>Add an ad account first.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="num">Total Added</th>
                  <th className="num">Allocated to Ads</th>
                  <th className="num">Not Allocated</th>
                  <th className="num">Spent</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {shownAccounts.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td className="num">{money(a.funds_added, a.currency)}</td>
                    <td className="num">{money(a.fund_allocated, a.currency)}</td>
                    <td className={`num ${a.unallocated < 0 ? 'neg' : ''}`}>{money(a.unallocated, a.currency)}</td>
                    <td className="num">{money(a.total_spent, a.currency)}</td>
                    <td className={`num ${a.balance < 0 ? 'neg' : 'pos'}`}>{money(a.balance, a.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">Fund for each ad is set on the ad itself (Ads → Edit → “Fund allocated”).</p>
      </div>

      <div className="card">
        <h3 className="card-title">Fund history</h3>
        {loading ? <Empty>Loading…</Empty> : funds.length === 0 ? <Empty>No funds added yet.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th className="num">Amount</th>
                  <th>Payment Method</th>
                  <th>Reference</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {funds.map((f) => (
                  <tr key={f.id}>
                    <td>{date(f.fund_date)}</td>
                    <td>{f.ad_account?.name}</td>
                    <td className="num pos">{money(f.amount, f.ad_account?.currency)}</td>
                    <td>{f.payment_method || '—'}</td>
                    <td className="mono">{f.reference || '—'}</td>
                    <td className="muted">{f.notes || ''}</td>
                    <td className="actions">
                      <button className="btn btn-sm" onClick={() => setEditing(f)}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => remove(f)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <FundForm
          initial={editing}
          accounts={accounts}
          defaultAccountId={accountId}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </>
  )
}

function FundForm({ initial, accounts, defaultAccountId, onClose, onSaved }) {
  const [form, setForm] = useState({
    ad_account_id: defaultAccountId || accounts.find((a) => a.status === 'active')?.id || '',
    amount: '',
    fund_date: today(),
    payment_method: '',
    reference: '',
    notes: '',
    ...initial,
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (initial.id) await api.put(`/funds/${initial.id}`, form)
      else await api.post('/funds', form)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={initial.id ? 'Edit Fund' : 'Add Fund'} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Alert>{error}</Alert>
        <Field label="Ad account *">
          <select value={form.ad_account_id} onChange={set('ad_account_id')} required>
            <option value="">Select account</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.status !== 'active' ? ' (inactive)' : ''}</option>)}
          </select>
        </Field>
        <div className="grid-2">
          <Field label="Amount *">
            <input type="number" step="0.01" min="0.01" value={form.amount} onChange={set('amount')} required autoFocus />
          </Field>
          <Field label="Date *">
            <input type="date" value={form.fund_date} onChange={set('fund_date')} required />
          </Field>
          <Field label="Payment method">
            <input list="payment-methods" value={form.payment_method ?? ''} onChange={set('payment_method')} />
            <datalist id="payment-methods">
              {['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Bank Transfer'].map((m) => <option key={m} value={m} />)}
            </datalist>
          </Field>
          <Field label="Reference / transaction ID">
            <input value={form.reference ?? ''} onChange={set('reference')} />
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
