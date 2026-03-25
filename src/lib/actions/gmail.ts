"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { ApplicationStatus, SuggestedAction } from "@/generated/prisma/client";

async function getAuthUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function extractEmailBody(payload: gmail_v1.Schema$MessagePart): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractEmailBody(part);
      if (text) return text;
    }
  }
  return "";
}

const IGNORED_SENDER_DOMAINS = new Set([
  "gmail", "yahoo", "outlook", "hotmail", "icloud", "protonmail",
  "indeed", "linkedin", "glassdoor", "handshake", "ziprecruiter",
  "monster", "waterlooworks", "myworkdayjobs", "greenhouse", "lever",
  "workable", "ashbyhq", "jobvite", "icims", "taleo", "successfactors",
]);

function extractCompanyFromSender(from: string): string | null {
  // Try display name first: "Acme Corp <recruiting@acme.com>"
  const displayMatch = from.match(/^"?([^"<]+?)"?\s*</);
  if (displayMatch) {
    const name = displayMatch[1].trim();
    // Ignore generic names like "Recruiting", "HR", "Careers", "No Reply", etc.
    if (!/^(no.?reply|do.?not.?reply|recruiting|careers|hr|jobs|talent|hiring|notifications?|alerts?|support|info|hello|team|noreply)$/i.test(name)) {
      return name;
    }
  }

  // Fall back to domain: strip common subdomains and known generic domains
  const emailMatch = from.match(/@([^>>\s]+)/);
  if (emailMatch) {
    const parts = emailMatch[1].split(".");
    // Take second-to-last segment (e.g. "acme" from "mail.acme.com")
    const domain = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (!IGNORED_SENDER_DOMAINS.has(domain.toLowerCase())) {
      // Capitalise first letter
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  }

  return null;
}

export async function syncGmailEmails() {
  const userId = await getAuthUserId();

  const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true, lastEmailSync: true },
  });

  if (user?.lastEmailSync) {
    const elapsed = Date.now() - new Date(user.lastEmailSync).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      const label = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      return { error: `Please wait ${label} before syncing again.` };
    }
  }

  if (!user?.googleAccessToken) {
    return {
      error:
        "No Google account connected. Please sign out and sign in with Google to enable Gmail sync.",
    };
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken ?? undefined,
  });

  // Persist refreshed tokens back to DB automatically
  oauth2Client.on("tokens", async (tokens) => {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(tokens.access_token && { googleAccessToken: tokens.access_token }),
        ...(tokens.refresh_token && {
          googleRefreshToken: tokens.refresh_token,
        }),
      },
    });
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    maxResults: 50,
  });

  const messages = listResponse.data.messages ?? [];
  if (messages.length === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastEmailSync: new Date() },
    });
    return { success: true, newSuggestions: 0 };
  }

  const messageIds = messages.map((m) => m.id!).filter(Boolean);

  const existingIds = await prisma.emailSuggestion.findMany({
    where: { userId, emailMessageId: { in: messageIds } },
    select: { emailMessageId: true },
  });
  const existingIdSet = new Set(existingIds.map((e) => e.emailMessageId));

  const newMessages = messages.filter(
    (m) => m.id && !existingIdSet.has(m.id)
  );

  if (newMessages.length === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastEmailSync: new Date() },
    });
    return { success: true, newSuggestions: 0 };
  }

  const fullMessages = await Promise.all(
    newMessages.map((m) =>
      gmail.users.messages.get({ userId: "me", id: m.id!, format: "full" })
    )
  );

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let newSuggestions = 0;

  for (const response of fullMessages) {
    const message = response.data;
    if (!message.id) continue;

    const headers = message.payload?.headers ?? [];
    const subject =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ??
      "(no subject)";
    const from =
      headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
    const dateStr =
      headers.find((h) => h.name?.toLowerCase() === "date")?.value ?? "";
    const snippet = message.snippet ?? "";

    const emailDate = dateStr ? new Date(dateStr) : new Date();
    const body = message.payload ? extractEmailBody(message.payload) : "";
    const emailText = `Subject: ${subject}\nFrom: ${from}\nSnippet: ${snippet}\n\nBody:\n${body.slice(0, 2000)}`;

    let classification: {
      action: string;
      status: string | null;
      company: string | null;
      role: string | null;
      confidence: number;
      reasoning: string;
    };

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You classify emails related to job/internship applications. Return JSON with:
- action: "NEW_APPLICATION" | "STATUS_UPDATE" | "IRRELEVANT"
- status: "APPLIED" | "OA" | "INTERVIEW" | "FINAL_ROUND" | "OFFER" | "REJECTED" | "WITHDRAWN" | null
- company: string | null
- role: string | null
- confidence: number (0-1)
- reasoning: string (one sentence)

NEW_APPLICATION: email confirms an application was just submitted (e.g. "we received your application", "your application has been submitted", "thanks for applying").
STATUS_UPDATE: email signals a change in an existing application — this includes rejections, interview invites, offers, OA invites, and any other update. Common rejection phrases that mean STATUS_UPDATE with status REJECTED: "not moving forward", "will not be moving forward", "not to move forward with your candidacy", "have decided not to proceed", "we will not be proceeding", "after careful consideration", "not selected", "not successful", "unfortunately", "we won't be moving forward", "thank you for taking part in the recruitment process" (when combined with a negative outcome), "keep your details in our database", "we encourage you to apply to future positions".
IRRELEVANT: unrelated to job applications, OR is an account/profile setup email (e.g. "set up your candidate account", "complete your profile", "verify your email", "activate your account", "create your account", "welcome to", onboarding emails from job platforms, login/password emails). Classify as IRRELEVANT even if the email mentions a company or job title.

IMPORTANT: An email that thanks you for participating in a recruitment process AND delivers a negative outcome is always STATUS_UPDATE (REJECTED), never NEW_APPLICATION. Only classify as NEW_APPLICATION if the email is purely confirming a fresh submission with no outcome mentioned.

For the company field: extract the employer/hiring company, NOT the job board or platform the email was sent through. Indeed, LinkedIn, Glassdoor, Handshake, WaterlooWorks, ZipRecruiter, Monster, and similar are job boards — never use them as the company value. Look inside the email body for the actual employer name (e.g. "You applied to Software Engineer at Stripe" → company: "Stripe"). If you cannot identify the actual employer, set company to null.`,
          },
          { role: "user", content: emailText },
        ],
      });
      classification = JSON.parse(
        completion.choices[0].message.content ?? "{}"
      );
    } catch {
      continue;
    }

    if (
      classification.action === "IRRELEVANT" ||
      !["NEW_APPLICATION", "STATUS_UPDATE"].includes(classification.action)
    ) {
      continue;
    }

    await prisma.emailSuggestion.create({
      data: {
        userId,
        emailMessageId: message.id,
        emailSubject: subject,
        emailSender: from,
        emailDate,
        emailSnippet: snippet || null,
        suggestedAction: classification.action as SuggestedAction,
        suggestedStatus: (classification.status as ApplicationStatus) ?? null,
        suggestedCompany: classification.company ?? extractCompanyFromSender(from),
        suggestedRole: classification.role ?? null,
        confidence: Math.min(1, Math.max(0, classification.confidence ?? 0)),
        reasoning: classification.reasoning ?? null,
      },
    });

    newSuggestions++;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastEmailSync: new Date() },
  });

  revalidatePath("/dashboard");
  return { success: true, newSuggestions };
}
