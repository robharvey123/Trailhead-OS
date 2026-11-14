import { redirect } from 'next/navigation'

export const metadata = { title: 'Sales' }

export default function SalesIndex() {
  redirect('/sales/dashboard')
}
