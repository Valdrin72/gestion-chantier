import { env } from "@/lib/env";

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f5f5f5;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e5e5">
      <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
      ${body}
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
      <p style="color:#888;font-size:12px;margin:0">Archi Platform · ${env.APP_URL}</p>
    </div></body></html>`;
}

export const emailTemplates = {
  validationRequested: (params: {
    requesterName: string;
    fileName: string;
    projectName: string;
    fileUrl: string;
    message?: string;
  }) => ({
    subject: `Validation demandée — ${params.fileName}`,
    html: layout(
      `Validation demandée`,
      `<p><strong>${params.requesterName}</strong> vous demande de valider le document
       <strong>${params.fileName}</strong> du projet <em>${params.projectName}</em>.</p>
       ${params.message ? `<blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#555">${params.message}</blockquote>` : ""}
       <p><a href="${params.fileUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Examiner le document</a></p>`,
    ),
  }),
  validationDecided: (params: {
    fileName: string;
    decision: "APPROVED" | "REJECTED";
    reviewerName: string;
    fileUrl: string;
    comment?: string;
  }) => ({
    subject: `${params.decision === "APPROVED" ? "Validé" : "Refusé"} — ${params.fileName}`,
    html: layout(
      `${params.decision === "APPROVED" ? "Document validé" : "Document refusé"}`,
      `<p><strong>${params.reviewerName}</strong> a ${params.decision === "APPROVED" ? "validé" : "refusé"}
       le document <strong>${params.fileName}</strong>.</p>
       ${params.comment ? `<blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#555">${params.comment}</blockquote>` : ""}
       <p><a href="${params.fileUrl}">Ouvrir le document</a></p>`,
    ),
  }),
  fileAdded: (params: {
    uploaderName: string;
    fileName: string;
    projectName: string;
    fileUrl: string;
  }) => ({
    subject: `Nouveau document — ${params.fileName}`,
    html: layout(
      `Nouveau document`,
      `<p><strong>${params.uploaderName}</strong> a ajouté le document
       <strong>${params.fileName}</strong> au projet <em>${params.projectName}</em>.</p>
       <p><a href="${params.fileUrl}">Ouvrir</a></p>`,
    ),
  }),
  mention: (params: {
    authorName: string;
    fileName: string;
    excerpt: string;
    fileUrl: string;
  }) => ({
    subject: `${params.authorName} vous a mentionné — ${params.fileName}`,
    html: layout(
      `Vous avez été mentionné`,
      `<p><strong>${params.authorName}</strong> vous a mentionné dans un commentaire sur
       <strong>${params.fileName}</strong> :</p>
       <blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#555">${params.excerpt}</blockquote>
       <p><a href="${params.fileUrl}">Répondre</a></p>`,
    ),
  }),
  lifecycleAlert: (params: {
    assetName: string;
    severity: string;
    message: string;
    assetUrl: string;
  }) => ({
    subject: `[${params.severity}] ${params.assetName}`,
    html: layout(
      `Alerte cycle de vie`,
      `<p><strong>${params.assetName}</strong> — ${params.message}</p>
       <p><a href="${params.assetUrl}">Voir l'élément</a></p>`,
    ),
  }),
};
