import {
  Prisma,
  PrismaClient,
  ReservationStatus,
} from '@prisma/client'
import { 
  ValidationError, 
  OutOfStockError, 
  DatabaseError,
  NotFoundError,
  ExpiredReservationError,
  InvalidReservationStateError
} from '@/lib/errors'

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
  confirmedAt?: Date | null
  releasedAt?: Date | null
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

export class ReservationService {
  static async confirmReservation(
    reservationId: string,
  ): Promise<ReservationResponse> {
    if (!reservationId) {
      throw new ValidationError('reservationId is required')
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<
            Array<{
              id: string
              customerId: string
              status: ReservationStatus
              expiresAt: Date
              confirmedAt: Date | null
              releasedAt: Date | null
            }>
          >`
            SELECT *
            FROM "Reservation"
            WHERE "id" = ${reservationId}
            FOR UPDATE NOWAIT
          `

          if (rows.length === 0) {
            throw new NotFoundError('Reservation not found')
          }

          const reservation = rows[0]

          if (reservation.status !== ReservationStatus.pending) {
            throw new InvalidReservationStateError(
              `Reservation status is ${reservation.status}, expected pending`,
            )
          }

          if (new Date(reservation.expiresAt) < new Date()) {
            throw new ExpiredReservationError('Reservation has expired')
          }

          const updated = await tx.reservation.update({
            where: { id: reservationId },
            data: {
              status: ReservationStatus.confirmed,
              confirmedAt: new Date(),
            },
            include: { items: true },
          })

          return {
            id: updated.id,
            customerId: updated.customerId,
            status: updated.status,
            expiresAt: updated.expiresAt,
            confirmedAt: updated.confirmedAt,
            releasedAt: updated.releasedAt,
            items: updated.items.map((item) => ({
              productId: item.productId,
              warehouseId: item.warehouseId,
              quantity: item.quantity,
            })),
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      )
    } catch (error: unknown) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof ExpiredReservationError ||
        error instanceof InvalidReservationStateError
      ) {
        throw error
      }

      if (error instanceof Error) {
        throw new DatabaseError(`Failed to confirm reservation: ${error.message}`)
      }

      throw new DatabaseError('Unknown confirmation failure')
    }
  }

  static async releaseReservation(
    reservationId: string,
  ): Promise<boolean> {
    if (!reservationId) {
      throw new ValidationError('reservationId is required')
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<
            Array<{ id: string; status: ReservationStatus }>
          >`
            SELECT *
            FROM "Reservation"
            WHERE "id" = ${reservationId}
            FOR UPDATE NOWAIT
          `

          if (rows.length === 0) {
            throw new NotFoundError('Reservation not found')
          }

          const reservation = rows[0]

          if (
            reservation.status === ReservationStatus.released ||
            reservation.status === ReservationStatus.confirmed
          ) {
            return false
          }

          const items = await tx.reservationItem.findMany({
            where: { reservationId },
          })

          for (const item of items) {
            await tx.$queryRaw`
              SELECT *
              FROM "Stock"
              WHERE "productId" = ${item.productId}
                AND "warehouseId" = ${item.warehouseId}
              FOR UPDATE
            `

            await tx.stock.update({
              where: {
                productId_warehouseId: {
                  productId: item.productId,
                  warehouseId: item.warehouseId,
                },
              },
              data: {
                reservedUnits: { decrement: item.quantity },
              },
            })
          }

          await tx.reservation.update({
            where: { id: reservationId },
            data: {
              status: ReservationStatus.released,
              releasedAt: new Date(),
            },
          })

          return true
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      )
    } catch (error: unknown) {
      if (
        error instanceof ValidationError ||
        error instanceof NotFoundError
      ) {
        throw error
      }

      if (error instanceof Error) {
        throw new DatabaseError(`Failed to release reservation: ${error.message}`)
      }

      throw new DatabaseError('Unknown release failure')
    }
  }
}
