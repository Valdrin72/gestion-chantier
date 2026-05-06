"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";

export function NewVersionButton({ fileId }: { fileId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleFile(file: File) {
    setPending(true);
    try {
      const note = window.prompt("Note de version (optionnel) :") ?? "";
      const fd = new FormData();
      fd.append("file", file);
      fd.append("changeNote", note);
      const res = await fetch(`/api/files/${fileId}/versions`, { method: "POST", body: fd });
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={pending}>
        <History className="h-4 w-4" />
        {pending ? "Téléversement…" : "Nouvelle version"}
      </Button>
    </>
  );
}
