import {
  Prisma,
  PrismaClient,
  ReservationStatus,
} from '@prisma/client'
import { ValidationError, OutOfStockError, DatabaseError } from '@/lib/errors'

const prisma = new PrismaClient()

export interface ReservationItemResponse {
  productId: string
  warehouseId: string
  quantity: number
}

export interface ReservationResponse {
  id: string
  customerId: string
  status: ReservationStatus
  expiresAt: Date
  items: ReservationItemResponse[]
}

type StockRow = {
  id: string
  productId: string
  warehouseId: string
  totalUnits: number
  reservedUnits: number
}

export async function reserve(
  productId: string,
  warehouseId: string,
  quantity: number,
  customerId: string,
  expiryMinutes = 10,
): Promise<ReservationResponse | null> {
  if (!productId) throw new ValidationError('productId is required')
  if (!warehouseId) throw new ValidationError('warehouseId is required')
  if (!customerId) throw new ValidationError('customerId is required')
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ValidationError('quantity must be a positive integer')
  }
  if (!Number.isInteger(expiryMinutes) || expiryMinutes <= 0) {
    throw new ValidationError('expiryMinutes must be positive')
  }

  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const lockedRows = await tx.$queryRaw<StockRow[]>`
          SELECT *
          FROM "Stock"
          WHERE "productId" = ${productId}
            AND "warehouseId" = ${warehouseId}
          FOR UPDATE NOWAIT
        `

        if (lockedRows.length === 0) {
          throw new OutOfStockError('Stock record not found')
        }

        const stock = lockedRows[0]
        const available = stock.totalUnits - stock.reservedUnits

        if (available < quantity) {
          throw new OutOfStockError(
            `Insufficient inventory. Available=${available}, requested=${quantity}`,
          )
        }

        const reservation = await tx.reservation.create({
          data: {
            customerId,
            status: ReservationStatus.pending,
            expiresAt,
            items: {
              create: { productId, warehouseId, quantity },
            },
          },
          include: { items: true },
        })

        await tx.stock.update({
          where: {
            productId_warehouseId: { productId, warehouseId },
          },
          data: {
            reservedUnits: { increment: quantity },
          },
        })

        return {
          id: reservation.id,
          customerId: reservation.customerId,
          status: reservation.status,
          expiresAt: reservation.expiresAt,
          items: reservation.items.map((item) => ({
            productId: item.productId,
            warehouseId: item.warehouseId,
            quantity: item.quantity,
          })),
        } satisfies ReservationResponse
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    )

    return result
  } catch (error: unknown) {
    if (error instanceof ValidationError) throw error
    if (error instanceof OutOfStockError) return null

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(`Database transaction failed: ${error.message}`)
    }

    if (error instanceof Error) {
      if (
        error.message.includes('FOR UPDATE') ||
        error.message.includes('could not obtain lock') ||
        error.message.includes('deadlock') ||
        error.message.includes('serialization')
      ) {
        throw new DatabaseError(error.message)
      }
      throw new DatabaseError(`Unexpected database error: ${error.message}`)
    }

    throw new DatabaseError('Unknown reservation failure')
  }
}
