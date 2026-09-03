'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { getInvoiceBillToDisplay } from '@/lib/invoice-bill-to'
import { calculateTotals, roundMoney, type Account, type Contact, type Invoice, type InvoicePayment, type InvoiceStatus, type Workstream } from '@/lib/types'
import { formatMoney } from '@/lib/money'
import ConfirmDialog from './ConfirmDialog'
import InvoicePayments from './InvoicePayments'
import RecordEmailDialog from './RecordEmailDialog'
import WorkstreamBadge from './WorkstreamBadge'
import StatusBadge from './StatusBadge'
import { deleteInvoice, sendInvoiceToFreeAgent } from '@/app/(os)/invoicing/[id]/actions'

export default function InvoiceDetailClient({
  invoice,
  contact,
  account = null,
  payments = [],
  workstream,
  subscriptionStatus,
  warning,
  isAdmin = false,
}: {
  invoice: Invoice
  contact: Contact | null
  account?: Account | null
  payments?: InvoicePayment[]
  workstream: Workstream | null
  subscriptionStatus: string | null
  warning?: string | null
  isAdmin?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [updatingStatus, setUpdatingStatus] = useState<InvoiceStatus | 'cancelled' | null>(null)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [faUrl, setFaUrl] = useState<string | null>(invoice.freeagent_invoice_url ?? null)
  const [faPending, startFa] = useTransition()

  function sendToFreeAgent() {
    startFa(async () => {
      const res = await sendInvoiceToFreeAgent(invoice.id)
      if (res.error) toast.error(res.error)
      else {
        setFaUrl(res.url ?? null)
        toast.success('Sent to FreeAgent as a draft invoice')
      }
    })
  }
  const [paymentLink, setPaymentLink] = useState(invoice.stripe_payment_link ?? '')
  const [subscriptionState, setSubscriptionState] = useState({
    isRecurring: invoice.is_recurring ?? false,
    interval: invoice.recurring_interval ?? null,
    status: subscriptionStatus,
  })
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [recurringInterval, setRecurringInterval] = useState<'month' | 'year'>(
    invoice.recurring_interval ?? 'month'
  )
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const paidToastShownRef = useRef(false)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const totals = calculateTotals(invoice.line_items, invoice.vat_rate)
  const billTo = getInvoiceBillToDisplay(invoice, contact, account)
  const truncatedPaymentLink =
    paymentLink.length > 52 ? `${paymentLink.slice(0, 49)}...` : paymentLink
  const amountPaid = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0))
  const balance = roundMoney(totals.total - amountPaid)
  const isPaid = invoice.status === 'paid'
  const isPartPaid = invoice.status === 'part_paid'

  useEffect(() => {
    if (searchParams.get('paid') === 'true' && !paidToastShownRef.current) {
      paidToastShownRef.current = true
      toast.success('Payment confirmed by Stripe')
    }
  }, [searchParams])

  async function updateStatus(nextStatus: InvoiceStatus) {
    setUpdatingStatus(nextStatus)
    setError(null)

    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update invoice')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice')
    } finally {
      setUpdatingStatus(null)
    }
  }

  async function cancelInvoice() {
    await updateStatus('cancelled')
    setCancelConfirmOpen(false)
  }

  async function handleCopyLink() {
    if (!paymentLink) {
      return
    }

    try {
      await navigator.clipboard.writeText(paymentLink)
      setCopied(true)
      toast.success('Payment link copied')
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Failed to copy payment link')
    }
  }

  async function generatePaymentLink() {
    setPaymentLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.id }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create Stripe payment link')
      }

      setPaymentLink(data.payment_link)
      toast.success(paymentLink ? 'Payment link refreshed' : 'Payment link created')
      router.refresh()
    } catch (paymentError) {
      const message =
        paymentError instanceof Error ? paymentError.message : 'Failed to create payment link'
      setError(message)
      toast.error(message)
    } finally {
      setPaymentLoading(false)
    }
  }

  async function createRecurringSubscription() {
    setSubscriptionLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoice.id,
          interval: recurringInterval,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create recurring payment')
      }

      setSubscriptionState({
        isRecurring: true,
        interval: recurringInterval,
        status: 'incomplete',
      })
      setShowRecurringModal(false)
      toast.success('Recurring payment set up in Stripe')
      router.refresh()
    } catch (subscriptionError) {
      const message =
        subscriptionError instanceof Error
          ? subscriptionError.message
          : 'Failed to create recurring payment'
      setError(message)
      toast.error(message)
    } finally {
      setSubscriptionLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    // On success this redirects to /invoicing (throws NEXT_REDIRECT); only an
    // explicit { error } comes back.
    const res = await deleteInvoice(invoice.id)
    if (res?.error) {
      setError(res.error)
      setDeleting(false)
      setDeleteConfirmOpen(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Predictable back target — works from email links / bookmarks, unlike router.back(). */}
      <Link href="/invoicing" className="inline-flex items-center gap-1 text-sm text-[color:var(--text-3)] transition hover:text-[color:var(--text)]">
        ← Back to invoices
      </Link>

      {isPaid ? (
        <div className="rounded-[1.75rem] border border-[color:var(--emerald)] bg-[var(--emerald-dim)] px-5 py-4 text-sm text-[color:var(--emerald-strong)]">
          Paid in full on {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </div>
      ) : isPartPaid ? (
        <div className="rounded-[1.75rem] border border-[color:var(--amber)] bg-[var(--amber-dim)] px-5 py-4 text-sm text-[color:var(--amber-strong)]">
          Part paid, {formatMoney(balance, invoice.currency)} outstanding
        </div>
      ) : null}

      {warning === 'edit-blocked' ? (
        <div className="rounded-[1.75rem] border border-[color:var(--amber)] bg-[var(--amber-dim)] px-5 py-4 text-sm text-[color:var(--amber-strong)]">
          Only draft invoices can be edited. You were redirected back to the detail view.
        </div>
      ) : null}

      <div className="os-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="os-eyebrow">Invoice</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="os-page-title">
                {invoice.invoice_number}
              </h1>
            </div>
            <div className="mt-4">
              <StatusBadge status={invoice.status} kind="invoice" />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
            >
              Download PDF
            </a>
            <RecordEmailDialog
              kind="invoice"
              recordId={invoice.id}
              buttonLabel="Email invoice"
              dialogTitle="Email invoice"
              defaultRecipient={billTo.bill_to_email ?? contact?.email ?? null}
              defaultSubject={`Invoice ${invoice.invoice_number}`}
              defaultMessage={`Hi,\n\nPlease find the attached invoice ${invoice.invoice_number}.\n\nThank you.`}
              buttonClassName="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
              // Emailing the invoice IS sending it. Without this the client has
              // the invoice while the OS still records it as a draft.
              onSent={async () => {
                if (invoice.status === 'draft') await updateStatus('sent')
              }}
            />
            {isAdmin ? (
              faUrl ? (
                <a
                  href={faUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
                >
                  In FreeAgent ↗
                </a>
              ) : (
                <button
                  type="button"
                  onClick={sendToFreeAgent}
                  disabled={faPending}
                  className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] disabled:opacity-60"
                >
                  {faPending ? 'Sending…' : 'Send to FreeAgent'}
                </button>
              )
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="rounded-2xl border border-[color:var(--red)] px-4 py-2.5 text-sm font-medium text-[color:var(--red)] transition hover:bg-[var(--red-dim)]"
              >
                Delete
              </button>
            ) : null}
            {invoice.status === 'draft' ? (
              <Link
                href={`/invoicing/${invoice.id}/edit`}
                className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                Edit
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">Issue date</p>
            <p className="mt-2 text-sm text-[color:var(--text-2)]">{invoice.issue_date}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">Due date</p>
            <p className="mt-2 text-sm text-[color:var(--text-2)]">{invoice.due_date ?? '—'}</p>
            {invoice.po_number ? (
              <p className="mt-1 text-sm text-[color:var(--text-2)]">PO number: {invoice.po_number}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">Bill to</p>
            <p className="mt-2 text-sm text-[color:var(--text-2)]">{billTo.bill_to_name ?? '—'}</p>
            {billTo.bill_to_address ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--text-2)]">{billTo.bill_to_address}</p>
            ) : null}
            {billTo.bill_to_city || billTo.bill_to_postcode ? (
              <p className="mt-1 text-sm text-[color:var(--text-2)]">
                {[billTo.bill_to_city, billTo.bill_to_postcode].filter(Boolean).join(', ')}
              </p>
            ) : null}
            {billTo.bill_to_country ? (
              <p className="mt-1 text-sm text-[color:var(--text-2)]">{billTo.bill_to_country}</p>
            ) : null}
            {billTo.bill_to_email ? (
              <p className="mt-2 text-sm text-[color:var(--text-2)]">{billTo.bill_to_email}</p>
            ) : null}
            {billTo.bill_to_phone ? (
              <p className="text-sm text-[color:var(--text-2)]">{billTo.bill_to_phone}</p>
            ) : null}
            {billTo.bill_to_vat_number ? (
              <p className="mt-1 text-sm text-[color:var(--text-2)]">VAT: {billTo.bill_to_vat_number}</p>
            ) : null}
            {billTo.bill_to_company_number ? (
              <p className="text-sm text-[color:var(--text-2)]">Company no: {billTo.bill_to_company_number}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">Workstream</p>
            <div className="mt-2">
              {workstream ? (
                <WorkstreamBadge
                  label={workstream.label}
                  slug={workstream.slug}
                  colour={workstream.colour}
                />
              ) : (
                <p className="text-sm text-[color:var(--text-2)]">—</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="os-card p-6">
        <h2 className="os-section-title">Line items</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-[color:var(--text-3)]">
              <tr>
                <th className="pb-3">Description</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Unit price</th>
                <th className="pb-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item) => (
                <tr key={item.id} className="border-t border-[color:var(--border)]">
                  <td className="py-3 text-[color:var(--text)]">{item.description}</td>
                  <td className="py-3 text-right text-[color:var(--text-2)]">{item.qty}</td>
                  <td className="py-3 text-right text-[color:var(--text-2)]">{formatMoney(item.unit_price, invoice.currency)}</td>
                  <td className="py-3 text-right text-[color:var(--text)]">
                    {formatMoney(item.qty * item.unit_price, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {invoice.notes ? (
          <div className="os-card p-6">
            <h2 className="os-section-title">Notes</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm text-[color:var(--text-2)]">{invoice.notes}</p>
          </div>
        ) : (
          <div />
        )}

        <div className="space-y-6">
          <div className="os-card p-6">
            <h2 className="os-section-title">Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[color:var(--text-2)]">Subtotal</dt>
                <dd className="font-medium text-[color:var(--text)]">{formatMoney(totals.subtotal, invoice.currency)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[color:var(--text-2)]">VAT ({invoice.vat_rate}%)</dt>
                <dd className="font-medium text-[color:var(--text)]">{formatMoney(totals.vat_amount, invoice.currency)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-[color:var(--border)] pt-3">
                <dt className="text-base font-semibold text-[color:var(--text)]">Total</dt>
                <dd className="text-lg font-semibold text-[color:var(--text)]">{formatMoney(totals.total, invoice.currency)}</dd>
              </div>
              {amountPaid > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[color:var(--text-2)]">Payments received</dt>
                    <dd className="font-medium text-[color:var(--text)]">−{formatMoney(amountPaid, invoice.currency)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-[color:var(--border)] pt-3">
                    <dt className="text-base font-semibold text-[color:var(--text)]">Balance outstanding</dt>
                    <dd className={`text-lg font-bold ${balance > 0 ? 'text-[color:var(--amber-strong)]' : 'text-[color:var(--emerald-strong)]'}`}>
                      {formatMoney(balance, invoice.currency)}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
          </div>

          {invoice.status !== 'draft' && invoice.status !== 'cancelled' ? (
            <InvoicePayments
              invoiceId={invoice.id}
              currency={invoice.currency ?? 'GBP'}
              total={totals.total}
              initialPayments={payments}
              status={invoice.status}
              recordOpen={recordPaymentOpen}
              onRecordOpenChange={setRecordPaymentOpen}
            />
          ) : null}

          <div className="os-card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="os-section-title">Payment</h2>
              {subscriptionState.isRecurring && subscriptionState.interval ? (
                <span className="rounded-full border border-[color:var(--accent)] bg-[var(--accent-dim)] px-3 py-1 text-xs font-medium text-[color:var(--accent-strong)]">
                  Recurring: {formatMoney(totals.total, invoice.currency)}/{subscriptionState.interval}
                </span>
              ) : null}
            </div>

            {subscriptionState.isRecurring && subscriptionState.status ? (
              <div className="mt-4">
                <span className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-medium text-[color:var(--text-2)]">
                  {subscriptionState.status}
                </span>
              </div>
            ) : null}

            {isPaid ? (
              <p className="mt-4 text-sm text-[color:var(--emerald-strong)]">
                This invoice has been paid. Stripe payment actions are no longer needed.
              </p>
            ) : paymentLink ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[1.5rem] border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-3)]">Payment link</p>
                  <p className="mt-2 break-all text-sm text-[color:var(--text-2)]">{truncatedPaymentLink}</p>
                  <p className="mt-2 text-xs text-[color:var(--text-3)]">Client can pay online at this link.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void generatePaymentLink()}
                    disabled={paymentLoading}
                    className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                  >
                    {paymentLoading ? 'Generating...' : 'Resend link'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <button
                  type="button"
                  onClick={() => void generatePaymentLink()}
                  disabled={paymentLoading}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {paymentLoading ? 'Generating...' : 'Send payment link'}
                </button>
                <p className="text-sm text-[color:var(--text-2)]">Client can pay online at this link.</p>
              </div>
            )}

            {!isPaid && !subscriptionState.isRecurring ? (
              <div className="mt-6 border-t border-[color:var(--border)] pt-6">
                <button
                  type="button"
                  onClick={() => setShowRecurringModal(true)}
                  className="rounded-2xl border border-[color:var(--accent)] px-4 py-2.5 text-sm font-medium text-[color:var(--accent-strong)] transition hover:border-[color:var(--accent-hover)]"
                >
                  Set up recurring payment
                </button>
              </div>
            ) : null}
          </div>

          <div className="os-card p-6">
            <h2 className="os-section-title">Actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {invoice.status === 'draft' ? (
                <>
                  <button
                    type="button"
                    onClick={() => updateStatus('sent')}
                    disabled={updatingStatus !== null}
                    className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                  >
                    {updatingStatus === 'sent' ? 'Updating...' : 'Mark as sent (already emailed)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={updatingStatus !== null}
                    className="rounded-2xl border border-[color:var(--red)] px-4 py-2.5 text-sm font-medium text-[color:var(--red-strong)] transition hover:border-[color:var(--red-strong)] disabled:opacity-60"
                  >
                    Cancel invoice
                  </button>
                </>
              ) : null}
              {invoice.status === 'sent' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setRecordPaymentOpen(true)}
                    className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
                  >
                    Record payment
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus('overdue')}
                    disabled={updatingStatus !== null}
                    className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)] disabled:opacity-60"
                  >
                    {updatingStatus === 'overdue' ? 'Updating...' : 'Mark as overdue'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={updatingStatus !== null}
                    className="rounded-2xl border border-[color:var(--red)] px-4 py-2.5 text-sm font-medium text-[color:var(--red-strong)] transition hover:border-[color:var(--red-strong)] disabled:opacity-60"
                  >
                    Cancel invoice
                  </button>
                </>
              ) : null}
              {invoice.status === 'overdue' || invoice.status === 'part_paid' ? (
                <button
                  type="button"
                  onClick={() => setRecordPaymentOpen(true)}
                  className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
                >
                  Record payment
                </button>
              ) : null}
            </div>
            {error ? <p className="mt-4 text-sm text-[color:var(--red-strong)]">{error}</p> : null}
          </div>
        </div>
      </div>

      {showRecurringModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-[color:var(--border)] bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
            <h2 className="os-section-title">Set up recurring payment</h2>
            <p className="mt-2 text-sm text-[color:var(--text-2)]">
              Confirm the recurring amount and billing interval for this invoice.
            </p>

            <div className="mt-6 rounded-[1.5rem] border border-[color:var(--border)] bg-[var(--surface-2)] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-3)]">Amount</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--text)]">{formatMoney(totals.total, invoice.currency)}</p>
            </div>

            <div className="mt-6 flex gap-3">
              {(['month', 'year'] as const).map(interval => (
                <button
                  key={interval}
                  type="button"
                  onClick={() => setRecurringInterval(interval)}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    recurringInterval === interval
                      ? 'border-[color:var(--accent)] bg-[var(--accent-dim)] text-[color:var(--accent-strong)]'
                      : 'border-[color:var(--border)] text-[color:var(--text-2)] hover:border-[color:var(--accent)]'
                  }`}
                >
                  {interval === 'month' ? 'Monthly' : 'Yearly'}
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRecurringModal(false)}
                className="rounded-2xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-2)] transition hover:border-[color:var(--accent)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createRecurringSubscription()}
                disabled={subscriptionLoading}
                className="rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {subscriptionLoading ? 'Setting up...' : 'Confirm recurring payment'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        title="Cancel this invoice?"
        description="The invoice will be marked as cancelled. This can be reversed by updating the status."
        confirmLabel="Cancel invoice"
        onConfirm={() => void cancelInvoice()}
        loading={updatingStatus === 'cancelled'}
        variant="warning"
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={`Delete invoice ${invoice.invoice_number}?`}
        description="This can be restored from the database if needed."
        confirmLabel="Delete invoice"
        onConfirm={() => void handleDelete()}
        loading={deleting}
        variant="destructive"
      />
    </div>
  )
}
