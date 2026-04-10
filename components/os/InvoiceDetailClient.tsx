'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getInvoiceBillToDisplay } from '@/lib/invoice-bill-to'
import { calculateTotals, type Contact, type Invoice, type InvoiceStatus, type Workstream } from '@/lib/types'
import ConfirmDialog from './ConfirmDialog'
import RecordEmailDialog from './RecordEmailDialog'
import WorkstreamBadge from './WorkstreamBadge'
import StatusBadge from './StatusBadge'

function formatMoney(value: number) {
  return `£${value.toFixed(2)}`
}

export default function InvoiceDetailClient({
  invoice,
  contact,
  workstream,
  subscriptionStatus,
  warning,
}: {
  invoice: Invoice
  contact: Contact | null
  workstream: Workstream | null
  subscriptionStatus: string | null
  warning?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [updatingStatus, setUpdatingStatus] = useState<InvoiceStatus | 'cancelled' | null>(null)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const totals = calculateTotals(invoice.line_items, invoice.vat_rate)
  const billTo = getInvoiceBillToDisplay(invoice, contact)
  const truncatedPaymentLink =
    paymentLink.length > 52 ? `${paymentLink.slice(0, 49)}...` : paymentLink
  const isPaid = Boolean(invoice.paid_at)

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

  return (
    <div className="space-y-6">
      {isPaid ? (
        <div className="rounded-[1.75rem] border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
          Paid on {invoice.paid_at ? new Date(invoice.paid_at).toLocaleString('en-GB') : '—'}
        </div>
      ) : null}

      {warning === 'edit-blocked' ? (
        <div className="rounded-[1.75rem] border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
          Only draft invoices can be edited. You were redirected back to the detail view.
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-white0">Invoice</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-white">
                {invoice.invoice_number}
              </h1>
              {invoice.pricing_tier ? (
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-100">
                  {invoice.pricing_tier.name} tier
                </span>
              ) : null}
            </div>
            <div className="mt-4">
              <StatusBadge status={invoice.status} kind="invoice" />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              className="rounded-2xl border border-[#2A2A3A] px-4 py-2.5 text-sm font-medium text-[#9CA3AF] transition hover:border-[#B8FF00]/40"
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
              buttonClassName="rounded-2xl border border-[#2A2A3A] px-4 py-2.5 text-sm font-medium text-[#9CA3AF] transition hover:border-[#B8FF00]/40"
            />
            {invoice.status === 'draft' ? (
              <Link
                href={`/invoicing/${invoice.id}/edit`}
                className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90"
              >
                Edit
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white0">Issue date</p>
            <p className="mt-2 text-sm text-[#9CA3AF]">{invoice.issue_date}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white0">Due date</p>
            <p className="mt-2 text-sm text-[#9CA3AF]">{invoice.due_date ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white0">Bill to</p>
            <p className="mt-2 text-sm text-[#9CA3AF]">{billTo.bill_to_name ?? '—'}</p>
            {billTo.bill_to_address ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#9CA3AF]">{billTo.bill_to_address}</p>
            ) : null}
            {billTo.bill_to_city || billTo.bill_to_postcode ? (
              <p className="mt-1 text-sm text-[#9CA3AF]">
                {[billTo.bill_to_city, billTo.bill_to_postcode].filter(Boolean).join(', ')}
              </p>
            ) : null}
            {billTo.bill_to_country ? (
              <p className="mt-1 text-sm text-[#9CA3AF]">{billTo.bill_to_country}</p>
            ) : null}
            {billTo.bill_to_email ? (
              <p className="mt-2 text-sm text-[#9CA3AF]">{billTo.bill_to_email}</p>
            ) : null}
            {billTo.bill_to_phone ? (
              <p className="text-sm text-[#9CA3AF]">{billTo.bill_to_phone}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white0">Workstream</p>
            <div className="mt-2">
              {workstream ? (
                <WorkstreamBadge
                  label={workstream.label}
                  slug={workstream.slug}
                  colour={workstream.colour}
                />
              ) : (
                <p className="text-sm text-[#9CA3AF]">—</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
        <h2 className="text-lg font-semibold text-white">Line items</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-white0">
              <tr>
                <th className="pb-3">Description</th>
                <th className="pb-3 text-right">Qty</th>
                <th className="pb-3 text-right">Unit price</th>
                <th className="pb-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items.map((item) => (
                <tr key={item.id} className="border-t border-[#2A2A3A]">
                  <td className="py-3 text-white">{item.description}</td>
                  <td className="py-3 text-right text-[#9CA3AF]">{item.qty}</td>
                  <td className="py-3 text-right text-[#9CA3AF]">{formatMoney(item.unit_price)}</td>
                  <td className="py-3 text-right text-white">
                    {formatMoney(item.qty * item.unit_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {invoice.notes ? (
          <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
            <h2 className="text-lg font-semibold text-white">Notes</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm text-[#9CA3AF]">{invoice.notes}</p>
          </div>
        ) : (
          <div />
        )}

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
            <h2 className="text-lg font-semibold text-white">Summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#9CA3AF]">Subtotal</dt>
                <dd className="font-medium text-white">{formatMoney(totals.subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[#9CA3AF]">VAT ({invoice.vat_rate}%)</dt>
                <dd className="font-medium text-white">{formatMoney(totals.vat_amount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-[#2A2A3A] pt-3">
                <dt className="text-base font-semibold text-white">Total</dt>
                <dd className="text-lg font-semibold text-white">{formatMoney(totals.total)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Payment</h2>
              {subscriptionState.isRecurring && subscriptionState.interval ? (
                <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-100">
                  Recurring: {formatMoney(totals.total)}/{subscriptionState.interval}
                </span>
              ) : null}
            </div>

            {subscriptionState.isRecurring && subscriptionState.status ? (
              <div className="mt-4">
                <span className="rounded-full border border-[#2A2A3A] px-3 py-1 text-xs font-medium text-[#9CA3AF]">
                  {subscriptionState.status}
                </span>
              </div>
            ) : null}

            {isPaid ? (
              <p className="mt-4 text-sm text-emerald-200">
                This invoice has been paid. Stripe payment actions are no longer needed.
              </p>
            ) : paymentLink ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-[1.5rem] border border-[#2A2A3A] bg-[#13131E] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white0">Payment link</p>
                  <p className="mt-2 break-all text-sm text-[#9CA3AF]">{truncatedPaymentLink}</p>
                  <p className="mt-2 text-xs text-white0">Client can pay online at this link.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleCopyLink()}
                    className="rounded-2xl border border-[#2A2A3A] px-4 py-2.5 text-sm font-medium text-[#9CA3AF] transition hover:border-[#B8FF00]/40"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void generatePaymentLink()}
                    disabled={paymentLoading}
                    className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90 disabled:opacity-60"
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
                  className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90 disabled:opacity-60"
                >
                  {paymentLoading ? 'Generating...' : 'Send payment link'}
                </button>
                <p className="text-sm text-[#9CA3AF]">Client can pay online at this link.</p>
              </div>
            )}

            {!isPaid && !subscriptionState.isRecurring ? (
              <div className="mt-6 border-t border-[#2A2A3A] pt-6">
                <button
                  type="button"
                  onClick={() => setShowRecurringModal(true)}
                  className="rounded-2xl border border-fuchsia-500/30 px-4 py-2.5 text-sm font-medium text-fuchsia-100 transition hover:border-fuchsia-400"
                >
                  Set up recurring payment
                </button>
              </div>
            ) : null}
          </div>

          <div className="rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6">
            <h2 className="text-lg font-semibold text-white">Actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {invoice.status === 'draft' ? (
                <>
                  <button
                    type="button"
                    onClick={() => updateStatus('sent')}
                    disabled={updatingStatus !== null}
                    className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90 disabled:opacity-60"
                  >
                    {updatingStatus === 'sent' ? 'Updating...' : 'Mark as sent'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={updatingStatus !== null}
                    className="rounded-2xl border border-rose-500/30 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:border-rose-400 disabled:opacity-60"
                  >
                    Cancel invoice
                  </button>
                </>
              ) : null}
              {invoice.status === 'sent' ? (
                <>
                  <button
                    type="button"
                    onClick={() => updateStatus('paid')}
                    disabled={updatingStatus !== null}
                    className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90 disabled:opacity-60"
                  >
                    {updatingStatus === 'paid' ? 'Updating...' : 'Mark as paid'}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus('overdue')}
                    disabled={updatingStatus !== null}
                    className="rounded-2xl border border-[#2A2A3A] px-4 py-2.5 text-sm font-medium text-[#9CA3AF] transition hover:border-[#B8FF00]/40 disabled:opacity-60"
                  >
                    {updatingStatus === 'overdue' ? 'Updating...' : 'Mark as overdue'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={updatingStatus !== null}
                    className="rounded-2xl border border-rose-500/30 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:border-rose-400 disabled:opacity-60"
                  >
                    Cancel invoice
                  </button>
                </>
              ) : null}
              {invoice.status === 'overdue' ? (
                <button
                  type="button"
                  onClick={() => updateStatus('paid')}
                  disabled={updatingStatus !== null}
                  className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90 disabled:opacity-60"
                >
                  {updatingStatus === 'paid' ? 'Updating...' : 'Mark as paid'}
                </button>
              ) : null}
            </div>
            {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
          </div>
        </div>
      </div>

      {showRecurringModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#13131E] px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-[#2A2A3A] bg-[#1A1A28] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Set up recurring payment</h2>
            <p className="mt-2 text-sm text-[#9CA3AF]">
              Confirm the recurring amount and billing interval for this invoice.
            </p>

            <div className="mt-6 rounded-[1.5rem] border border-[#2A2A3A] bg-[#13131E] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-white0">Amount</p>
              <p className="mt-2 text-2xl font-semibold text-white">{formatMoney(totals.total)}</p>
            </div>

            <div className="mt-6 flex gap-3">
              {(['month', 'year'] as const).map(interval => (
                <button
                  key={interval}
                  type="button"
                  onClick={() => setRecurringInterval(interval)}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                    recurringInterval === interval
                      ? 'border-white/60 bg-white/10 text-white'
                      : 'border-[#2A2A3A] text-[#9CA3AF] hover:border-[#B8FF00]/40'
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
                className="rounded-2xl border border-[#2A2A3A] px-4 py-2.5 text-sm font-medium text-[#9CA3AF] transition hover:border-[#B8FF00]/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createRecurringSubscription()}
                disabled={subscriptionLoading}
                className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0C0C14] transition hover:bg-[#B8FF00]/90 disabled:opacity-60"
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
    </div>
  )
}
