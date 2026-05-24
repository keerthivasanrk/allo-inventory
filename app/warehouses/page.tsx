'use client'

import { useEffect, useState } from 'react'
import { Building2, MapPin, Package } from 'lucide-react'

interface WarehouseStock {
  id: string
  name: string
  location: string
  _count?: { stock: number }
}

function WarehouseSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 rounded bg-slate-200" />
          <div className="h-4 w-28 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/warehouses')
        if (!res.ok) throw new Error('Failed to fetch warehouses')
        const data = await res.json() as WarehouseStock[]
        setWarehouses(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Warehouses</h1>
        <p className="text-sm text-slate-500">
          All fulfillment centers in the network
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <WarehouseSkeleton key={i} />)}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-red-600 underline hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && warehouses.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">No warehouses configured yet.</p>
        </div>
      )}

      {/* Warehouse grid */}
      {!loading && !error && warehouses.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="truncate font-semibold text-slate-900">{wh.name}</h2>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {wh.location}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <Package className="h-4 w-4 text-slate-400" />
                <span className="text-xs text-slate-600">
                  Fulfillment center · active
                </span>
              </div>

              <a
                href={`/products?warehouseId=${wh.id}`}
                className="mt-4 block w-full rounded-lg bg-blue-600 py-2 text-center text-sm font-medium text-white transition hover:bg-blue-700"
              >
                View inventory →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
