import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-session'
import { fetchPostsByAccount } from '@/lib/queries/conversions'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const accountId = searchParams.get('accountId')
  const q = searchParams.get('q') ?? undefined

  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
  }
  if (!UUID_RE.test(accountId)) {
    return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 })
  }

  try {
    const posts = await fetchPostsByAccount(accountId, q)
    return NextResponse.json(posts)
  } catch (err) {
    console.error('[GET /api/conversions/posts-by-account]', err)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}
