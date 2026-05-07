import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-session'
import { deleteConversion } from '@/lib/queries/conversions'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid conversion id' }, { status: 400 })
  }

  try {
    await deleteConversion(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/conversions/[id]]', err)
    return NextResponse.json({ error: 'Failed to delete conversion' }, { status: 500 })
  }
}
