"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function FileViewer({
  url,
  mimeType,
  isPdf,
}: {
  url: string | null;
  mimeType: string | null;
  isPdf: boolean;
}) {
  if (!url) {
    return (
      <div className="border rounded-md p-10 text-center text-muted-foreground">
        Aucun fichier disponible.
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="border rounded-md overflow-hidden bg-muted">
        <iframe src={url} className="w-full h-[75vh]" title="PDF" />
      </div>
    );
  }

  if (mimeType?.startsWith("image/")) {
    return (
      <div className="border rounded-md p-2 bg-muted flex justify-center">
        <img src={url} alt="" className="max-h-[75vh] object-contain" />
      </div>
    );
  }

  return (
    <div className="border rounded-md p-10 text-center">
      <p className="text-muted-foreground mb-4">Aperçu non disponible pour ce type de fichier.</p>
      <Button asChild>
        <a href={url} download>
          <Download className="h-4 w-4" /> Télécharger
        </a>
      </Button>
    </div>
  );
}
