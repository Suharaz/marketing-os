import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-session'
import { conversionInput } from '@/lib/validation/conversion-schema'
import { fetchRecentConversions, createConversion } from '@/lib/queries/conversions'

export const runtime = 'nodejs'

export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const conversions = await fetchRecentConversions(50)
    return NextResponse.json(conversions)
  } catch (err) {
    console.error('[GET /api/conversions]', err)
    return NextResponse.json({ error: 'Failed to fetch conversions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = conversionInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const id = await createConversion(parsed.data, user.userId)
    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/conversions]', err)
    return NextResponse.json({ error: 'Failed to create conversion' }, { status: 500 })
  }
}
