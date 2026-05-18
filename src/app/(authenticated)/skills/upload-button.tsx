'use client';

// Nút "Upload" trigger UploadDialog. Tách riêng vì server component (page)
// không state được — phải có client wrapper cho `useState(open)`.

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UploadDialog } from './upload-dialog';

export function UploadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Upload Skill
      </Button>
      <UploadDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
