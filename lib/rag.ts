import fs from "node:fs";
import path from "node:path";
import { EMBEDDING_MODEL, openai } from "./openai";

export type Chunk = {
    id: string;
    source: string; // e.g., URL or file path
    title?: string;
    text: string;
    embedding: number[];
};

const DATA_PATH = path.join(process.cwd(), "data", "chunks.json");

export function loadChunks(): Chunk[] {
    if (!fs.existsSync(DATA_PATH)) return [];
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function cosine(a: number[], b: number[]) {
    let dot = 0,
        an = 0,
        bn = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        an += a[i] * a[i];
        bn += b[i] * b[i];
    }
    return dot / (Math.sqrt(an) * Math.sqrt(bn));
}

async function embed(text: string) {
    const res = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
    });
    return res.data[0].embedding;
}

export async function retrieve(query: string, k = 6) {
    const chunks = loadChunks();
    if (!chunks.length) return [] as Chunk[];
    const qemb = await embed(query);
    const scored = chunks
        .map((c) => ({ c, score: cosine(qemb, c.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map((x) => x.c);
    return scored;
}

export function toContext(chunks: Chunk[]) {
    return chunks
        .map(
        (c, i) =>
            `# Source ${i + 1}\nTITLE: ${c.title ?? ""}\nSOURCE: ${
            c.source
            }\nCONTENT:\n${c.text}`
        )
        .join("\n\n---\n\n");
}
