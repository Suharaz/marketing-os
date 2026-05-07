'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

interface Props {
  id: string
}

export function DeleteConversionButton({ id }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch(`/api/conversions/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Xóa thất bại')
        return
      }
      toast.success('Đã xóa conversion')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Lỗi kết nối mạng')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="xs"
        onClick={() => setOpen(true)}
      >
        Xóa
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa?</DialogTitle>
            <DialogDescription>
              Hành động này không thể hoàn tác. Conversion sẽ bị xóa vĩnh viễn.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" disabled={loading} />
              }
            >
              Hủy
            </DialogClose>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={handleConfirm}
            >
              {loading ? 'Đang xóa…' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
