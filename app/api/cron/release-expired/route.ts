import { NextRequest, NextResponse } from 'next/server'
import { ExpiryService } from '@/services/expiry.service'
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const CRON_SECRET = process.env.CRON_SECRET

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    logger.warn('Unauthorized cron invocation attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await ExpiryService.releaseExpiredReservations()
    
    // Log to Winston
    logger.info(`Released ${result.released} expired reservations`, {
      processed: result.processed,
      failed: result.failed
    })

    // Send to Sentry for monitoring
    Sentry.captureMessage(
      `Released ${result.released} expired reservations`,
      'info'
    )
    
    return NextResponse.json({ 
      success: true, 
      processed: result.processed,
      released: result.released,
      failed: result.failed
    })
  } catch (error) {
    logger.error('CRON Fatal Error', { error })
    Sentry.captureException(error)

    return NextResponse.json(
      { error: 'Failed to release expired' },
      { status: 500 }
    )
  }
}
