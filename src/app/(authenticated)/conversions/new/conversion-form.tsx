'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { z } from 'zod'
import { conversionInput } from '@/lib/validation/conversion-schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AccountOption } from './page'

interface PostOption {
  id: string
  content: string | null
  published_at: string | null
}

interface Props {
  accounts: AccountOption[]
}

function defaultDateTime(): string {
  return new Date().toISOString().slice(0, 16)
}

const vndFmt = new Intl.NumberFormat('vi-VN')

export function ConversionForm({ accounts }: Props) {
  const router = useRouter()

  const [accountId, setAccountId] = useState('')
  const [postId, setPostId] = useState('')
  const [posts, setPosts] = useState<PostOption[]>([])
  const [postSearch, setPostSearch] = useState('')
  const [postsLoading, setPostsLoading] = useState(false)
  const [channelLabel, setChannelLabel] = useState('')
  const [count, setCount] = useState('1')
  // revenue: raw digits string for editing, formatted string when blurred
  const [revenueRaw, setRevenueRaw] = useState('')
  const [revenueDisplay, setRevenueDisplay] = useState('')
  const [revenueFocused, setRevenueFocused] = useState(false)
  const [occurredAt, setOccurredAt] = useState(defaultDateTime)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch posts when accountId or postSearch changes (debounced)
  const fetchPosts = useCallback(async (aid: string, q: string) => {
    if (!aid) { setPosts([]); return }
    setPostsLoading(true)
    try {
      const url = `/api/conversions/posts-by-account?accountId=${aid}${q ? `&q=${encodeURIComponent(q)}` : ''}`
      const res = await fetch(url)
      if (res.ok) {
        const data: PostOption[] = await res.json()
        setPosts(data)
      }
    } catch {
      // non-critical — ignore silently
    } finally {
      setPostsLoading(false)
    }
  }, [])

  useEffect(() => {
    setPostId('')
    setPosts([])
    setPostSearch('')
    if (accountId) {
      fetchPosts(accountId, '')
    }
  }, [accountId, fetchPosts])

  function handlePostSearchChange(q: string) {
    setPostSearch(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchPosts(accountId, q)
    }, 300)
  }

  function handleRevenueBlur() {
    setRevenueFocused(false)
    const digits = revenueRaw.replace(/\D/g, '')
    const num = digits ? Number(digits) : 0
    setRevenueRaw(digits)
    setRevenueDisplay(digits ? vndFmt.format(num) : '')
  }

  function handleRevenueFocus() {
    setRevenueFocused(true)
  }

  function handleRevenueChange(val: string) {
    // Allow only digits while focused
    const digits = val.replace(/\D/g, '')
    setRevenueRaw(digits)
  }

  function buildPayload() {
    return {
      source_account_id: accountId,
      source_post_id: postId || null,
      channel_label: channelLabel,
      conversion_count: Number(count),
      revenue_vnd: Number(revenueRaw || '0'),
      occurred_at: new Date(occurredAt).toISOString(),
      note: note || null,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const payload = buildPayload()
    const parsed = conversionInput.safeParse(payload)
    if (!parsed.success) {
      const flat = parsed.error.flatten()
      const fieldErrors: Record<string, string> = {}
      for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
        if (Array.isArray(msgs) && msgs.length > 0) {
          fieldErrors[field] = msgs[0] as string
        }
      }
      setErrors(fieldErrors)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      if (res.ok) {
        toast.success('Đã lưu conversion!')
        router.push('/conversions')
        return
      }

      const data = await res.json().catch(() => ({}))
      if (res.status === 400 && data?.details?.fieldErrors) {
        const fieldErrors: Record<string, string> = {}
        for (const [field, msgs] of Object.entries(
          data.details.fieldErrors as Record<string, string[]>
        )) {
          if (msgs.length > 0) fieldErrors[field] = msgs[0]!
        }
        setErrors(fieldErrors)
      } else {
        toast.error(data?.error ?? 'Lưu thất bại')
      }
    } catch {
      toast.error('Lỗi kết nối mạng')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 bg-white rounded-xl border p-6">
      {/* Account */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account">Account *</Label>
        <Select value={accountId} onValueChange={(v) => setAccountId(v ?? '')}>
          <SelectTrigger id="account" className="w-full" aria-invalid={!!errors.source_account_id}>
            <SelectValue placeholder="Chọn account…" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name} ({a.platform})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.source_account_id && (
          <p className="text-xs text-destructive">{errors.source_account_id}</p>
        )}
      </div>

      {/* Post (optional) */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="post-search">Bài viết (tùy chọn)</Label>
        <Input
          id="post-search"
          placeholder={accountId ? 'Tìm bài viết…' : 'Chọn account trước'}
          disabled={!accountId}
          value={postSearch}
          onChange={(e) => handlePostSearchChange(e.target.value)}
        />
        {accountId && (
          <Select value={postId} onValueChange={(v) => setPostId(v ?? '')} disabled={postsLoading || posts.length === 0}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={postsLoading ? 'Đang tải…' : posts.length === 0 ? 'Không có bài viết' : 'Chọn bài viết…'} />
            </SelectTrigger>
            <SelectContent>
              {posts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.content ? p.content.slice(0, 80) : `(${p.id.slice(0, 8)}…)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Channel label */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="channel">Kênh chuyển đổi *</Label>
        <Input
          id="channel"
          placeholder="Vd: Inbox FB, Hotline, Comment…"
          value={channelLabel}
          onChange={(e) => setChannelLabel(e.target.value)}
          aria-invalid={!!errors.channel_label}
        />
        {errors.channel_label && (
          <p className="text-xs text-destructive">{errors.channel_label}</p>
        )}
      </div>

      {/* Count */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="count">Số lượng *</Label>
        <Input
          id="count"
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          aria-invalid={!!errors.conversion_count}
        />
        {errors.conversion_count && (
          <p className="text-xs text-destructive">{errors.conversion_count}</p>
        )}
      </div>

      {/* Revenue */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="revenue">Doanh thu (VND) *</Label>
        <Input
          id="revenue"
          inputMode="numeric"
          placeholder="0"
          value={revenueFocused ? revenueRaw : revenueDisplay}
          onFocus={handleRevenueFocus}
          onBlur={handleRevenueBlur}
          onChange={(e) => handleRevenueChange(e.target.value)}
          aria-invalid={!!errors.revenue_vnd}
        />
        {errors.revenue_vnd && (
          <p className="text-xs text-destructive">{errors.revenue_vnd}</p>
        )}
      </div>

      {/* DateTime */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="occurred-at">Thời gian *</Label>
        <Input
          id="occurred-at"
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          aria-invalid={!!errors.occurred_at}
        />
        {errors.occurred_at && (
          <p className="text-xs text-destructive">{errors.occurred_at}</p>
        )}
      </div>

      {/* Note */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Ghi chú</Label>
        <textarea
          id="note"
          rows={3}
          maxLength={500}
          placeholder="Ghi chú thêm (tùy chọn)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {errors.note && (
          <p className="text-xs text-destructive">{errors.note}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2">
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => router.push('/conversions')}
        >
          Hủy
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </div>
    </form>
  )
}
