import { ReactElement } from 'react'
import AdminLayout from '~/layouts/AdminLayout'

export default function AdminStatsIndex() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Statistiques</h1>
      <p className="text-stone-600 mt-2">Les statistiques seront implémentées en Epic 7.</p>
    </div>
  )
}

AdminStatsIndex.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
