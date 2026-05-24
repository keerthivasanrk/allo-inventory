'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StockBadge } from '@/components/domain/StockBadge'

interface WarehouseStock {
  warehouseId: string
  total: number
  reserved: number
  available: number
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  warehouses: WarehouseStock[]
}

interface ProductCardProps {
  product: Product
  selectedWarehouseId: string
  onReserve: (productId: string, warehouseId: string) => void
  isReserving?: boolean
}

export function ProductCard({
  product,
  selectedWarehouseId,
  onReserve,
  isReserving = false,
}: ProductCardProps) {
  const warehouseStock = useMemo(
    () => product.warehouses.find((w) => w.warehouseId === selectedWarehouseId),
    [product.warehouses, selectedWarehouseId],
  )

  const available = warehouseStock?.available ?? 0
  const isOutOfStock = available <= 0
  const noWarehouseSelected = !selectedWarehouseId || !warehouseStock

  function handleReserve() {
    if (!isOutOfStock && selectedWarehouseId) {
      onReserve(product.id, selectedWarehouseId)
    }
  }

  return (
    <Card className="flex flex-col transition-shadow duration-200 hover:shadow-md hover:border-slate-300 overflow-hidden">
      {/* Product Image */}
      <div className="h-48 w-full bg-slate-100 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://picsum.photos/seed/${product.id}/400/300`}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <CardHeader className="space-y-3 pt-4">
        {/* Name + stock badge */}
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">{product.name}</CardTitle>
          {!noWarehouseSelected && (
            <StockBadge
              total={warehouseStock!.total}
              reserved={warehouseStock!.reserved}
            />
          )}
        </div>

        {/* Price */}
        <div className="text-2xl font-bold tracking-tight text-slate-900">
          ${product.price.toFixed(2)}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 gap-4">
        {/* Description */}
        <p className="text-sm leading-relaxed text-slate-600 flex-1">
          {product.description ?? 'No description available.'}
        </p>

        {/* Stock breakdown — only when a warehouse is selected */}
        {warehouseStock && (
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {[
                { label: 'Total', value: warehouseStock.total },
                { label: 'Reserved', value: warehouseStock.reserved },
                { label: 'Available', value: warehouseStock.available },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-slate-500 text-xs">{label}</dt>
                  <dd className="font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Reserve button */}
        <Button
          id={`reserve-${product.id}`}
          className="w-full"
          disabled={isOutOfStock || noWarehouseSelected || isReserving}
          onClick={handleReserve}
          aria-label={
            noWarehouseSelected
              ? 'Select a warehouse to reserve'
              : isOutOfStock
                ? `${product.name} is out of stock`
                : `Reserve ${product.name}`
          }
        >
          {isReserving
            ? 'Reserving…'
            : noWarehouseSelected
              ? 'Select a warehouse'
              : isOutOfStock
                ? 'Out of Stock'
                : 'Reserve'}
        </Button>
      </CardContent>
    </Card>
  )
}

/** Skeleton for a product card while loading */
export function ProductCardSkeleton() {
  return (
    <Card className="animate-pulse" aria-hidden="true">
      <CardHeader className="space-y-4">
        <div className="flex justify-between gap-4">
          <div className="h-5 w-2/3 rounded bg-slate-200" />
          <div className="h-5 w-16 rounded-full bg-slate-200" />
        </div>
        <div className="h-8 w-24 rounded bg-slate-200" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-slate-200" />
          <div className="h-4 w-5/6 rounded bg-slate-200" />
        </div>
        <div className="h-16 rounded bg-slate-200" />
        <div className="h-9 w-full rounded bg-slate-200" />
      </CardContent>
    </Card>
  )
}
