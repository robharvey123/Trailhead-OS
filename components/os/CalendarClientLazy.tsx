'use client'

import dynamic from 'next/dynamic'
import { CalendarSkeleton } from './skeletons'

/**
 * Client boundary for the calendar.
 *
 * `CalendarClient` pulls in `@fullcalendar/react` plus the daygrid, timegrid,
 * list and interaction plugins — a few hundred kB of JS that is only ever needed
 * on `/calendar`. Importing it straight from the (server) page put all of it in
 * that route's first load; behind `next/dynamic` it becomes its own chunk.
 *
 * `ssr: false` because FullCalendar builds its grid from measured DOM, so the
 * server pass produces an empty shell and then re-renders on hydration anyway.
 */
const CalendarClient = dynamic(() => import('./CalendarClient'), {
  ssr: false,
  loading: () => <CalendarSkeleton />,
})

export default CalendarClient
