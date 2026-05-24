import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DIRECT_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const PRODUCT_ID = '11111111-1111-1111-1111-111111111111'
const WAREHOUSE_ID = '22222222-2222-2222-2222-222222222222'

async function setup() {
  console.log('Setting up database for load test...')

  await prisma.product.upsert({
    where: { id: PRODUCT_ID },
    update: {},
    create: {
      id: PRODUCT_ID,
      name: 'Load Test Product',
      description: 'The last unit available!',
      price: 99.99,
    }
  })

  await prisma.warehouse.upsert({
    where: { id: WAREHOUSE_ID },
    update: {},
    create: {
      id: WAREHOUSE_ID,
      name: 'Load Test Warehouse',
      location: 'Internet',
    }
  })

  await prisma.stock.upsert({
    where: {
      productId_warehouseId: {
        productId: PRODUCT_ID,
        warehouseId: WAREHOUSE_ID,
      }
    },
    update: {
      totalUnits: 1,
      reservedUnits: 0,
    },
    create: {
      productId: PRODUCT_ID,
      warehouseId: WAREHOUSE_ID,
      totalUnits: 1,
      reservedUnits: 0,
    }
  })

  // Clear out any old reservations for this product so it's clean
  await prisma.reservationItem.deleteMany({
    where: { productId: PRODUCT_ID }
  })

  console.log('Setup complete! Target Product:', PRODUCT_ID, 'Target Warehouse:', WAREHOUSE_ID)
}

setup().catch(console.error).finally(() => prisma.$disconnect())
