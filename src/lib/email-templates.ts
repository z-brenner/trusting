import { escapeHtml } from "./email";

/**
 * Plain-text and HTML email bodies for access-request decisions.
 * Everything user-controlled is escaped before it reaches the HTML variant.
 */
export type EmailContent = { subject: string; text: string; html: string };

function layout(title: string, bodyHtml: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c22;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5ea;border-radius:12px;padding:28px 32px;">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </div>
  </body>
</html>`;
}

function paragraph(text: string) {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">${text}</p>`;
}

export function formatExpiry(date: Date) {
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
}

export function accessApprovedEmail(input: {
  requesterName: string;
  companyName: string;
  documentTitles: string[];
  link: string;
  expiresAt: Date;
}): EmailContent {
  const org = input.companyName || "the Trust Center";
  const expiry = formatExpiry(input.expiresAt);
  const subject = `Your access request to ${org} documents was approved`;
  const docsText = input.documentTitles.map((t) => `  - ${t}`).join("\n");
  const text = [
    `Hello ${input.requesterName},`,
    "",
    `Your request to access the following documents from ${org} has been approved:`,
    docsText,
    "",
    "Open the link below to view them. Keep it private: anyone with the link can open the documents until it expires.",
    input.link,
    "",
    `This link expires on ${expiry}.`,
    "",
    "If you did not request access, you can ignore this email.",
  ].join("\n");

  const docsHtml = `<ul style="margin:0 0 12px 18px;padding:0;font-size:15px;line-height:1.55;">${input.documentTitles
    .map((t) => `<li>${escapeHtml(t)}</li>`)
    .join("")}</ul>`;
  const safeLink = escapeHtml(input.link);
  const html = layout(
    "Access approved",
    paragraph(`Hello ${escapeHtml(input.requesterName)},`) +
      paragraph(`Your request to access the following documents from ${escapeHtml(org)} has been approved:`) +
      docsHtml +
      paragraph(
        "Open the link below to view them. Keep it private: anyone with the link can open the documents until it expires.",
      ) +
      `<p style="margin:0 0 16px;"><a href="${safeLink}" style="display:inline-block;background:#2b59c3;color:#ffffff;text-decoration:none;font-weight:500;font-size:15px;padding:10px 16px;border-radius:8px;">Open documents</a></p>` +
      `<p style="margin:0 0 12px;font-size:13px;color:#5c5d66;word-break:break-all;">${safeLink}</p>` +
      paragraph(`This link expires on <strong>${escapeHtml(expiry)}</strong>.`) +
      `<p style="margin:0;font-size:13px;color:#5c5d66;">If you did not request access, you can ignore this email.</p>`,
  );
  return { subject, text, html };
}

export function accessRejectedEmail(input: {
  requesterName: string;
  companyName: string;
  reason: string;
}): EmailContent {
  const org = input.companyName || "the Trust Center";
  const subject = `Your access request to ${org} documents was not approved`;
  const reasonText = input.reason.trim();
  const text = [
    `Hello ${input.requesterName},`,
    "",
    `Your request to access documents from ${org} was not approved.`,
    ...(reasonText ? ["", `Reason: ${reasonText}`] : []),
    "",
    "If you believe this is a mistake, reply to this email or contact the organisation directly.",
  ].join("\n");
  const html = layout(
    "Your request was not approved",
    paragraph(`Hello ${escapeHtml(input.requesterName)},`) +
      paragraph(`Your request to access documents from ${escapeHtml(org)} was not approved.`) +
      (reasonText
        ? `<blockquote style="margin:0 0 12px;padding:10px 14px;border-left:3px solid #cfcfd6;color:#5c5d66;font-size:15px;line-height:1.55;">${escapeHtml(reasonText)}</blockquote>`
        : "") +
      `<p style="margin:0;font-size:13px;color:#5c5d66;">If you believe this is a mistake, reply to this email or contact the organisation directly.</p>`,
  );
  return { subject, text, html };
}
