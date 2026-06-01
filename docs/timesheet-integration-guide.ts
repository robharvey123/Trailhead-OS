/**
 * Timesheet Module Integration Guide
 * ===================================
 * 
 * This guide shows how to use the new timesheet module from within the app.
 */

// ── Start a timer (from any page via the TimerWidget component) ──────
// 
// 1. Import TimerWidget in a header/topbar component:
//    import TimerWidget from '@/components/os/TimerWidget'
//
// 2. Add to JSX:
//    <div className="flex items-center gap-2">
//      <TimerWidget />
//    </div>
//
// 3. Users can click "Start timer" without selecting an account/project
//    (this is fine for general time tracking)

// ── Manually log time for an account/project ───────────────────────
//
// From a client detail page, POST to /api/timesheet:
//
// POST /api/timesheet
// {
//   "account_id": "uuid",
//   "project_id": "uuid",           // optional
//   "entry_date": "2025-01-15",
//   "duration_minutes": 90,
//   "description": "Client meeting + planning",
//   "billable": true,
//   "rate_snapshot": 85.00          // uses account default if not provided
// }
//
// Returns: { entry: TimeEntry }

// ── View timesheet summary ────────────────────────────────────────
//
// Navigate to /timesheet (already in sidebar under Commercial)
// - Filters by client, date range (defaults to this week)
// - Shows total hours and billable amount
// - Lists all entries in a table

// ── Example: Generate invoice from timesheet ─────────────────────
//
// const entries = await getInvoiceableSummary(
//   accountId,
//   fromDate,
//   toDate
// );
//
// entries[0] = {
//   project_id: "uuid",
//   billable_minutes: 480,    // 8 hours
//   billable_amount: 680.00   // 8 × £85
// }

// ── Stop a running timer ──────────────────────────────────────────
//
// POST /api/timesheet/timer/{id}/stop
// {
//   "rate_snapshot": 85.00
// }
//
// Returns: { entry: TimeEntry } with elapsed duration_minutes calculated

// ── Project rates ────────────────────────────────────────────────
//
// When creating/editing a project (ProjectForm):
// - New field: "Hourly rate (£)"
// - Stores in projects.hourly_rate
// - When logging time to that project, uses project rate first
// - Falls back to account.default_hourly_rate if project rate not set

// ── Accounts with default rates ────────────────────────────────────
//
// Accounts table now has:
// - default_hourly_rate: numeric(10,2)    // e.g., 85.00
// - currency: text                         // default 'GBP'
//
// Set when creating/editing an account

// ── RLS Security ──────────────────────────────────────────────────
//
// Each user can only:
// - View/edit/delete their own time entries
// - Cannot see other users' time entries
// - Single running timer per user (DB constraint)

// ── Views for reporting ───────────────────────────────────────────
//
// SELECT * FROM project_totals;
// Results:
// {
//   project_id,
//   account_id,
//   project_name,
//   project_status,
//   total_minutes: 480,
//   billable_minutes: 480,
//   billable_amount: 680.00,
//   last_entry_date: "2025-01-15"
// }
//
// SELECT * FROM account_time_totals;
// Results:
// {
//   account_id,
//   business_name,
//   total_minutes: 960,
//   billable_minutes: 900,
//   billable_amount: 1275.00
// }

export {}
