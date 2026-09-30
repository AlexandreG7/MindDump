import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { assertGroupMember, resolveGroupId } from "@/lib/groupAuth";
import { isDay } from "@/lib/meals";
import { callClaudeTool, ClaudeError, isAiConfigured, type ClaudeContent } from "@/lib/ai/claude";
import {
  normalizeProposal,
  planningSystemPrompt,
  planningTool,
  type ImportPerson,
} from "@/lib/ai/importPlanning";

const DAY_MS = 86400000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 20000;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function dailyLimit(): number {
  const n = Number(process.env.AI_IMPORT_DAILY_LIMIT);
  return Number.isFinite(n) && n >= 0 ? n : 20;
}

async function remainingImports(userId: string): Promise<number> {
  const used = await prisma.aiImport.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
  });
  return Math.max(0, dailyLimit() - used);
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** État de l'import IA pour l'utilisateur : activé sur ce serveur, imports restants aujourd'hui. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!isAiConfigured()) return NextResponse.json({ enabled: false, limit: 0, remaining: 0 });
  return NextResponse.json({ enabled: true, limit: dailyLimit(), remaining: await remainingImports(user.id) });
}

/**
 * Analyse un document et renvoie des propositions, sans rien enregistrer.
 * multipart/form-data : `file` (image JPEG/PNG/WebP/GIF ou PDF, 10 Mo) et/ou
 * `text` (20 000 caractères), `groupId`, `timeZone` (IANA), `today` (yyyy-MM-dd
 * dans le fuseau de l'utilisateur).
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "L'import IA n'est pas activé sur ce serveur" }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulaire invalide" }, { status: 400 });
  }

  const groupIdParam = form.get("groupId");
  const groupId = await resolveGroupId(user.id, typeof groupIdParam === "string" && groupIdParam ? groupIdParam : null);
  const err = await assertGroupMember(groupId, user.id);
  if (err) return err;

  const tzParam = form.get("timeZone");
  const timeZone = typeof tzParam === "string" && isTimeZone(tzParam) ? tzParam : "Europe/Paris";
  const todayParam = form.get("today");
  const serverToday = new Date().toISOString().slice(0, 10);
  // Date du client acceptée à un jour près (fuseaux), sinon celle du serveur.
  const today =
    typeof todayParam === "string" &&
    isDay(todayParam) &&
    Math.abs(new Date(todayParam).getTime() - new Date(serverToday).getTime()) <= 2 * DAY_MS
      ? todayParam
      : serverToday;

  const content: ClaudeContent[] = [];
  let source: "image" | "pdf" | "text" = "text";

  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Fichier trop lourd (10 Mo au plus)" }, { status: 413 });
    }
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    if (file.type === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
      source = "pdf";
    } else if (IMAGE_TYPES.includes(file.type)) {
      content.push({ type: "image", source: { type: "base64", media_type: file.type, data } });
      source = "image";
    } else {
      return NextResponse.json({ error: "Format non pris en charge : photo (JPEG, PNG, WebP) ou PDF" }, { status: 415 });
    }
  }

  const textParam = form.get("text");
  const text = typeof textParam === "string" ? textParam.trim() : "";
  if (text.length > MAX_TEXT_CHARS) {
    return NextResponse.json({ error: "Texte trop long (20 000 caractères au plus)" }, { status: 413 });
  }
  if (text) content.push({ type: "text", text: content.length ? `Précisions de l'utilisateur :\n${text}` : text });
  if (content.length === 0) {
    return NextResponse.json({ error: "Ajoute une photo, un PDF ou du texte" }, { status: 400 });
  }
  if (source !== "text" && !text) content.push({ type: "text", text: "Voici le document." });

  if ((await remainingImports(user.id)) <= 0) {
    return NextResponse.json({ error: "Limite d'imports IA atteinte pour aujourd'hui" }, { status: 429 });
  }

  const people: ImportPerson[] = (
    await prisma.familyProfile.findMany({
      where: { groupId },
      select: { id: true, name: true, kind: true },
      orderBy: { position: "asc" },
    })
  ).map((p) => ({ id: p.id, name: p.name, kind: p.kind === "child" ? "child" : "adult" }));

  try {
    const { input, usage } = await callClaudeTool<unknown>({
      system: planningSystemPrompt({ today, timeZone, people }),
      content,
      tool: planningTool,
      maxTokens: 8192,
    });
    await prisma.aiImport.create({
      data: { userId: user.id, source, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
    });
    const proposal = normalizeProposal(input, people);
    return NextResponse.json({ ...proposal, groupId, remaining: await remainingImports(user.id) });
  } catch (e) {
    if (e instanceof ClaudeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
