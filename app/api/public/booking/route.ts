import { NextResponse } from 'next/server'
import { verifyPublicRequest } from '@/lib/onlineBooking/auth'
import {
  BookingError,
  createOnlineBooking,
  getAvailability,
  getBookingOptions,
  getOnlineBookingStatus,
} from '@/lib/onlineBooking/service'

// Online clinic booking API for gangsehat.com (server-to-server only).
// Every request is HMAC-signed with PUBLIC_API_SECRET (lib/onlineBooking/auth.ts);
// proxy.ts lets /api/public/* through without a session for that reason.
// Body: { action: 'options' | 'availability' | 'create' | 'status', ...params }

export const dynamic = 'force-dynamic'

const str = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length < 200 ? v : null)

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyPublicRequest(
    process.env.PUBLIC_API_SECRET,
    request.headers.get('x-gs-timestamp'),
    request.headers.get('x-gs-signature'),
    raw,
  )) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }) }

  const patientId = str(body.patientId)
  const profileId = str(body.profileId)

  try {
    switch (body.action) {
      case 'options': {
        if (!patientId || !profileId) break
        return NextResponse.json({ data: await getBookingOptions(patientId, profileId) })
      }
      case 'availability': {
        const branchId = str(body.branchId)
        const date = str(body.date)
        if (!branchId || !date) break
        return NextResponse.json({ data: await getAvailability(branchId, date) })
      }
      case 'create': {
        const branchId = str(body.branchId)
        const date = str(body.date)
        const returnUrl = str(body.returnUrl)
        if (!patientId || !profileId || !branchId || !date || !returnUrl || !/^https?:\/\//.test(returnUrl)) break
        const data = await createOnlineBooking({
          patientId,
          profileId,
          branchId,
          date,
          hour: Number(body.hour),
          staffId: str(body.staffId),
          mode: body.mode === 'package' ? 'package' : body.mode === 'pay' ? 'pay' : (body.mode as never),
          packageId: str(body.packageId),
          layananId: str(body.layananId),
          method: body.method === 'VA' ? 'VA' : body.method === 'QRIS' ? 'QRIS' : undefined,
          returnUrl,
        })
        return NextResponse.json({ data })
      }
      case 'status': {
        const bookingId = str(body.bookingId)
        if (!bookingId || !profileId) break
        return NextResponse.json({ data: await getOnlineBookingStatus(bookingId, profileId) })
      }
    }
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 422 })
    }
    console.error('public booking API failed', { action: body.action, error })
    return NextResponse.json({ error: 'server_error', message: 'Terjadi kesalahan. Silakan coba lagi.' }, { status: 500 })
  }
}
