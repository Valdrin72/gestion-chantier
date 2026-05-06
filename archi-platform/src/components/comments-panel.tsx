"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, AtSign } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Comment = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; image: string | null };
  targetType: "FILE" | "PDF_ANNOTATION";
  pdfPageNumber: number | null;
  pdfRect: { x: number; y: number; w: number; h: number } | null;
  mentions: { userId: string; userName: string; awaitingResponse: boolean }[];
  parentId: string | null;
};

const MENTION_PATTERN = /@\[([^\]]+)\]\(([^)]+)\)/g;

function renderBody(body: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_PATTERN);
  while ((m = re.exec(body))) {
    if (m.index > last) parts.push(body.slice(last, m.index));
    parts.push(
      <span key={m.index} className="bg-blue-100 text-blue-800 rounded px-1">@{m[1]}</span>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

export function CommentsPanel({
  fileId,
  comments,
  members,
}: {
  fileId: string;
  comments: Comment[];
  members: { id: string; name: string }[];
}) {
  const [body, setBody] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function insertMention(member: { id: string; name: string }) {
    setBody((b) => {
      // remplace le dernier @xxx par la mention formatée
      return b.replace(/@(\w*)$/, "") + `@[${member.name}](${member.id}) `;
    });
    setShowSuggest(false);
  }

  async function submit() {
    if (!body.trim()) return;
    const res = await fetch(`/api/files/${fileId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      setBody("");
      startTransition(() => router.refresh());
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Commentaires ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="relative">
            <textarea
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setShowSuggest(/@\w*$/.test(e.target.value));
              }}
              placeholder="Écrire un commentaire — utilisez @ pour mentionner"
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {showSuggest && (
              <div className="absolute z-10 mt-1 left-0 right-0 border bg-popover rounded shadow max-h-40 overflow-auto">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => insertMention(m)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2"
                  >
                    <AtSign className="h-3 w-3" /> {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={!body.trim()}>Publier</Button>
          </div>
        </div>

        <div className="space-y-2">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun commentaire.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="border rounded p-2 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.author.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(c.createdAt, "d MMM HH:mm", { locale: fr })}
                  </span>
                </div>
                {c.targetType === "PDF_ANNOTATION" && c.pdfPageNumber && (
                  <Badge variant="outline" className="text-xs">page {c.pdfPageNumber}</Badge>
                )}
                <p>{renderBody(c.body)}</p>
                {c.mentions.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {c.mentions
                      .filter((m) => m.awaitingResponse)
                      .map((m) => `↳ en attente de ${m.userName}`)
                      .join(" · ")}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
