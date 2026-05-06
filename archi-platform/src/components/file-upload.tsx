"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export function FileUpload({ projectId, folderId }: { projectId: string; folderId?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", file.name);
      if (folderId) fd.append("folderId", folderId);
      fd.append("notifyMembers", "1");
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setError(`Échec : ${file.name}`);
        return;
      }
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-sm text-destructive">{error}</span>}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={pending}
      >
        <Upload className="h-4 w-4" />
        {pending ? "Téléversement…" : "Téléverser"}
      </Button>
    </div>
  );
}
