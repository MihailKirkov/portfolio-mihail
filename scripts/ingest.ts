// scripts/ingest.ts
// Build local JSON vector store from:
// 1) Your public page (arg URL), 2) Extra Markdown in data/extra/*.md,
// 3) Firestore collections (experience, projects, skills) via Admin SDK.
//
// Usage:
//   npx tsx scripts/ingest.ts https://your-portfolio.vercel.app
//
// Requires:
//   - OPENAI_API_KEY
//   - Either FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { JSDOM } from "jsdom";
import { openai, EMBEDDING_MODEL } from "@/lib/openai";
import { adminDb } from "@/lib/firebaseAdmin";

const ROOT = process.argv[2];
if (!ROOT) {
    console.error("Usage: tsx scripts/ingest.ts https://portfolio-mihail.vercel.app");
    process.exit(1);
}

type Chunk = {
    id: string;
    source: string; // url | file:*.md | firestore:collection/docId
    title?: string;
    text: string;
    embedding: number[];
};

function sha1(s: string) {
    return crypto.createHash("sha1").update(s).digest("hex");
}

async function fetchHTML(url: string) {
    const res = await fetch(url);
    return await res.text();
}

function extractTextFromHTML(html: string) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  doc.querySelectorAll("script,style,nav,footer").forEach((el) => el.remove());
  const title = doc.querySelector("title")?.textContent ?? "";
  const text = doc.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return { title, text };
}

function chunkText(text: string, size = 1200, overlap = 120) {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size - overlap) out.push(text.slice(i, i + size));
  return out;
}

async function embedBatch(texts: string[]) {
  const out: number[][] = [];
  for (const t of texts) {
    const r = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: t });
    out.push(r.data[0].embedding);
  }
  return out;
}

/** 1) Web page */
async function ingestWebPage(url: string): Promise<Chunk[]> {
  const html = await fetchHTML(url);
  const { title, text } = extractTextFromHTML(html);
  if (!text) return [];
  const parts = chunkText(text);
  const embs = await embedBatch(parts);
  return parts.map((p, i) => ({
    id: sha1(url + i + p),
    source: url,
    title,
    text: p,
    embedding: embs[i],
  }));
}

/** 2) Extra markdown files */
async function ingestExtras(dir = path.join(process.cwd(), "data", "extra")): Promise<Chunk[]> {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => /\.(md|txt)$/i.test(f));
  const chunks: Chunk[] = [];
  for (const f of files) {
    const p = path.join(dir, f);
    const raw = fs.readFileSync(p, "utf8");
    const parts = chunkText(raw);
    const embs = await embedBatch(parts);
    for (let i = 0; i < parts.length; i++) {
      chunks.push({
        id: sha1(p + i + parts[i]),
        source: `file:${f}`,
        title: f.replace(/\.(md|txt)$/i, ""),
        text: parts[i],
        embedding: embs[i],
      });
    }
  }
  return chunks;
}

/** 3) Firestore content (server-only) */
async function ingestFirestore(): Promise<Chunk[]> {
  // Collections you want to expose to the bot:
  const targets = [
    { col: "experience", title: (d: any) => d.role ?? d.title ?? "Experience" },
    { col: "projects",   title: (d: any) => d.name ?? d.title ?? "Project"    },
    { col: "skills",     title: (d: any) => "Skills"                           },
  ];

  const chunks: Chunk[] = [];

  for (const t of targets) {
    const snap = await adminDb.collection(t.col).orderBy("order", "asc").get().catch(() => null);
    if (!snap || snap.empty) continue;

    for (const doc of snap.docs) {
      const data = doc.data();
      // Build a readable text block per document. Tweak fields to match your schema.
      const lines: string[] = [];

      // Common fields you might have:
      if (data.name) lines.push(`Name: ${data.name}`);
      if (data.role) lines.push(`Role: ${data.role}`);
      if (data.company) lines.push(`Company: ${data.company}`);
      if (data.title) lines.push(`Title: ${data.title}`);
      if (data.period) lines.push(`Period: ${data.period}`);
      if (data.location) lines.push(`Location: ${data.location}`);
      if (data.stack) lines.push(`Stack: ${Array.isArray(data.stack) ? data.stack.join(", ") : data.stack}`);
      if (data.skills) lines.push(`Skills: ${Array.isArray(data.skills) ? data.skills.join(", ") : data.skills}`);
      if (data.description) lines.push(String(data.description));
      if (Array.isArray(data.highlights)) {
        lines.push("Highlights:");
        for (const h of data.highlights) lines.push(`- ${h}`);
      }
      if (data.link) lines.push(`Link: ${data.link}`);
      if (data.repo) lines.push(`Repo: ${data.repo}`);

      const text = lines.join("\n").trim();
      if (!text) continue;

      const parts = chunkText(text);
      const embs = await embedBatch(parts);

      for (let i = 0; i < parts.length; i++) {
        chunks.push({
          id: sha1(`${t.col}/${doc.id}:${i}`),
          source: `firestore:${t.col}/${doc.id}`,
          title: t.title(data),
          text: parts[i],
          embedding: embs[i],
        });
      }
    }
  }

  return chunks;
}

async function run() {
  const webChunks = await ingestWebPage(ROOT);
  const extraChunks = await ingestExtras();
  const firestoreChunks = await ingestFirestore();

  const all = [...webChunks, ...extraChunks, ...firestoreChunks];

  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "chunks.json"), JSON.stringify(all, null, 2));
  console.log(`Wrote ${all.length} chunks to data/chunks.json`);
}

run();
