import { NextRequest, NextResponse } from 'next/server'
import { ExpiryService } from '@/services/expiry.service'

export const runtime = 'nodejs'

// Only allow calls from Vercel using the configured CRON_SECRET
const CRON_SECRET = process.env.CRON_SECRET

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const result = await ExpiryService.releaseExpiredReservations()
    
    return NextResponse.json({ 
      success: true, 
      processed: result.processed,
      released: result.released,
      failed: result.failed
    })
  } catch (error) {
    console.error('CRON Fatal Error:', error)
    return NextResponse.json(
      { error: 'Failed to release expired' },
      { status: 500 }
    )
  }
}
