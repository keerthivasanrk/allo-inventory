import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reserve } from '@/lib/services/reservationService'
import { ValidationError } from '@/lib/errors'
import { ReservationStatus } from '@prisma/client'

// vi.hoisted ensures these are available when vi.mock() factory runs (mock is hoisted above imports)
const { mockTransaction, mockQueryRaw, mockReservationCreate, mockStockUpdate } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockReservationCreate: vi.fn(),
  mockStockUpdate: vi.fn(),
}))

vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual<typeof import('@prisma/client')>('@prisma/client')
  return {
    ...actual,
    PrismaClient: vi.fn().mockImplementation(() => ({
      $transaction: mockTransaction,
    })),
  }
})

const stockFixture = {
  id: 'stock_1',
  productId: 'product_1',
  warehouseId: 'warehouse_1',
  totalUnits: 10,
  reservedUnits: 2,
}

const reservationFixture = {
  id: 'reservation_1',
  customerId: 'customer_1',
  status: ReservationStatus.pending,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  items: [{ productId: 'product_1', warehouseId: 'warehouse_1', quantity: 1 }],
}

function createMockTx() {
  return {
    $queryRaw: mockQueryRaw,
    reservation: { create: mockReservationCreate },
    stock: { update: mockStockUpdate },
  }
}

describe('reserve()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('happy path', () => {
    it('successfully reserves 1 unit', async () => {
      mockQueryRaw.mockResolvedValue([stockFixture])
      mockReservationCreate.mockResolvedValue(reservationFixture)
      mockStockUpdate.mockResolvedValue({ ...stockFixture, reservedUnits: 3 })
      mockTransaction.mockImplementation(async (callback: any) => callback(createMockTx()))

      const result = await reserve('product_1', 'warehouse_1', 1, 'customer_1')
      expect(result).not.toBeNull()
      expect(result?.customerId).toBe('customer_1')
      expect(result?.status).toBe(ReservationStatus.pending)
      expect(result?.items).toHaveLength(1)
      expect(mockStockUpdate).toHaveBeenCalledOnce()
    })

    it('returns reservation with correct ID', async () => {
      mockQueryRaw.mockResolvedValue([stockFixture])
      mockReservationCreate.mockResolvedValue(reservationFixture)
      mockStockUpdate.mockResolvedValue({})
      mockTransaction.mockImplementation(async (callback: any) => callback(createMockTx()))

      const result = await reserve('product_1', 'warehouse_1', 1, 'customer_1')
      expect(result?.id).toBe('reservation_1')
    })
  })

  describe('insufficient stock', () => {
    it('returns null when not enough units', async () => {
      mockQueryRaw.mockResolvedValue([{ ...stockFixture, totalUnits: 2, reservedUnits: 2 }])
      mockTransaction.mockImplementation(async (callback: any) => callback(createMockTx()))

      const result = await reserve('product_1', 'warehouse_1', 1, 'customer_1')
      expect(result).toBeNull()
    })

    it('does not modify database when stock insufficient', async () => {
      mockQueryRaw.mockResolvedValue([{ ...stockFixture, totalUnits: 1, reservedUnits: 1 }])
      mockTransaction.mockImplementation(async (callback: any) => callback(createMockTx()))

      await reserve('product_1', 'warehouse_1', 1, 'customer_1')
      expect(mockReservationCreate).not.toHaveBeenCalled()
      expect(mockStockUpdate).not.toHaveBeenCalled()
    })
  })

  describe('concurrent race condition', () => {
    it('exactly one succeeds and one fails for last unit', async () => {
      let reserved = false
      // Mutex serializes the two transactions so they run one-at-a-time,
      // matching real DB serialization behaviour
      let mutex = Promise.resolve()

      mockTransaction.mockImplementation(async (callback: any) => {
        const result = mutex.then(async () => {
          const tx = {
            $queryRaw: vi.fn().mockImplementation(() => {
              if (reserved) return [{ ...stockFixture, totalUnits: 1, reservedUnits: 1 }]
              return [{ ...stockFixture, totalUnits: 1, reservedUnits: 0 }]
            }),
            reservation: {
              create: vi.fn().mockImplementation(() => {
                reserved = true
                return { ...reservationFixture, id: crypto.randomUUID() }
              }),
            },
            stock: { update: vi.fn() },
          }
          return callback(tx)
        })
        mutex = result.then(() => {}, () => {})
        return result
      })

      const [r1, r2] = await Promise.all([
        reserve('product_1', 'warehouse_1', 1, 'customer_1'),
        reserve('product_1', 'warehouse_1', 1, 'customer_2'),
      ])

      const successCount = [r1, r2].filter(Boolean).length
      const failCount = [r1, r2].filter((r) => r === null).length

      expect(successCount).toBe(1)
      expect(failCount).toBe(1)
    })
  })

  describe('expiry', () => {
    it('creates reservation with correct expiresAt', async () => {
      mockQueryRaw.mockResolvedValue([stockFixture])
      const now = Date.now()
      const expectedExpiry = new Date(now + 15 * 60 * 1000)

      mockReservationCreate.mockResolvedValue({ ...reservationFixture, expiresAt: expectedExpiry })
      mockStockUpdate.mockResolvedValue({})
      mockTransaction.mockImplementation(async (callback: any) => callback(createMockTx()))

      const result = await reserve('product_1', 'warehouse_1', 1, 'customer_1', 15)
      expect(result).not.toBeNull()
      const diff = result!.expiresAt.getTime() - now
      expect(diff).toBeGreaterThanOrEqual(14 * 60 * 1000)
      expect(diff).toBeLessThanOrEqual(15 * 60 * 1000 + 1000)
    })

    it('defaults expiry to 10 minutes', async () => {
      mockQueryRaw.mockResolvedValue([stockFixture])
      const now = Date.now()

      mockReservationCreate.mockResolvedValue({
        ...reservationFixture,
        expiresAt: new Date(now + 10 * 60 * 1000),
      })
      mockStockUpdate.mockResolvedValue({})
      mockTransaction.mockImplementation(async (callback: any) => callback(createMockTx()))

      const result = await reserve('product_1', 'warehouse_1', 1, 'customer_1')
      expect(result).not.toBeNull()
      const diff = result!.expiresAt.getTime() - now
      expect(diff).toBeGreaterThanOrEqual(9 * 60 * 1000)
      expect(diff).toBeLessThanOrEqual(10 * 60 * 1000 + 1000)
    })
  })

  describe('edge cases', () => {
    it('throws ValidationError for zero quantity', async () => {
      await expect(reserve('product_1', 'warehouse_1', 0, 'customer_1')).rejects.toThrow(ValidationError)
    })

    it('throws ValidationError for negative quantity', async () => {
      await expect(reserve('product_1', 'warehouse_1', -5, 'customer_1')).rejects.toThrow(ValidationError)
    })

    it('returns null for non-existent product', async () => {
      mockQueryRaw.mockResolvedValue([])
      mockTransaction.mockImplementation(async (callback: any) => callback(createMockTx()))

      const result = await reserve('missing_product', 'warehouse_1', 1, 'customer_1')
      expect(result).toBeNull()
    })

    it('returns null for non-existent warehouse', async () => {
      mockQueryRaw.mockResolvedValue([])
      mockTransaction.mockImplementation(async (callback: any) => callback(createMockTx()))

      const result = await reserve('product_1', 'missing_warehouse', 1, 'customer_1')
      expect(result).toBeNull()
    })
  })
})
