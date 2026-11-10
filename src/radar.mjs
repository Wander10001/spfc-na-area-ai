import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const config = JSON.parse(await readFile(resolve(root, "config/feeds.json"), "utf8"));
const now = Date.now();
const maxAgeHours = config.maxAgeHours ?? 36;
const cutoff = now - maxAgeHours * 60 * 60 * 1000;

function clean(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ").trim();
}

function getTag(xml, name) {
  const match = xml.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return match ? clean(match[1]) : "";
}

function normalize(value = "") {
  return value.toLocaleLowerCase("pt-BR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(sao|paulo|spfc|futebol|clube|tricolor)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

function similarity(a, b) {
  const aa = new Set(normalize(a).split(" ").filter(w => w.length > 2));
  const bb = new Set(normalize(b).split(" ").filter(w => w.length > 2));
  if (!aa.size || !bb.size) return 0;
  let common = 0;
  for (const word of aa) if (bb.has(word)) common++;
  return common / (aa.size + bb.size - common);
}

function classify(text) {
  const categories = config.categories ?? {};
  let best = { name: "Geral", score: 0 };
  for (const [name, words] of Object.entries(categories)) {
    const hits = words.filter(word => text.includes(word.toLocaleLowerCase("pt-BR"))).length;
    const score = hits * (name === "Futebol profissional" ? 4 : 3);
    if (score > best.score) best = { name, score };
  }
  return best;
}

const collected = [];
const feedStats = [];
for (const feed of config.feeds) {
  try {
    const response = await fetch(feed.url, {
      headers: { "user-agent": "SPFC-NA-AREA-Radar/0.2" },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const xml = await response.text();
    const blocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match => match[1]);
    let accepted = 0;

    for (const block of blocks) {
      const title = getTag(block, "title");
      const link = getTag(block, "link") || (block.match(/<link[^>]*href=["']([^"']+)/i)?.[1] ?? "");
      const description = getTag(block, "description");
      const publishedAt = getTag(block, "pubDate");
      const publishedMs = Date.parse(publishedAt);
      const searchable = (title + " " + description).toLocaleLowerCase("pt-BR");

      if (!title || !link || !Number.isFinite(publishedMs) || publishedMs < cutoff || publishedMs > now + 60 * 60 * 1000) continue;
      if (!config.keywords.some(word => searchable.includes(word.toLocaleLowerCase("pt-BR")))) continue;
      if (config.exclude.some(word => searchable.includes(word.toLocaleLowerCase("pt-BR")))) continue;

      const category = classify(searchable);
      const ageHours = Math.max(0, (now - publishedMs) / 3600000);
      const freshness = Math.max(0, 30 - Math.floor(ageHours / 2));
      const relevance = Math.min(40, category.score * 5);
      const score = freshness + relevance;
      collected.push({
        title, link, description, publishedAt,
        publishedAtISO: new Date(publishedMs).toISOString(),
        ageHours: Math.round(ageHours * 10) / 10,
        source: feed.name, category: category.name, score
      });
      accepted++;
    }
    feedStats.push({ feed: feed.name, read: blocks.length, recentRelevant: accepted, status: "ok" });
    console.log("OK:", feed.name, "-", blocks.length, "lidos;", accepted, "recentes e relevantes");
  } catch (error) {
    feedStats.push({ feed: feed.name, status: "error", error: error.message });
    console.warn("Falha no feed:", feed.name, "-", error.message);
  }
}

// Junta matérias com títulos muito parecidos, mesmo quando os links são diferentes.
const grouped = [];
for (const item of collected.sort((a, b) => b.score - a.score)) {
  const match = grouped.find(existing =>
    existing.normalizedTitle === normalize(item.title) ||
    similarity(existing.title, item.title) >= 0.78
  );
  if (match) {
    match.alsoSeenIn.push({ source: item.source, link: item.link });
    if (Date.parse(item.publishedAt) > Date.parse(match.publishedAt)) {
      match.title = item.title;
      match.link = item.link;
      match.publishedAt = item.publishedAt;
      match.publishedAtISO = item.publishedAtISO;
      match.ageHours = item.ageHours;
    }
    match.score = Math.max(match.score, item.score);
  } else {
    grouped.push({ ...item, normalizedTitle: normalize(item.title), alsoSeenIn: [] });
  }
}

const ranked = grouped
  .map(({ normalizedTitle, ...item }) => item)
  .sort((a, b) => b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  .slice(0, config.maxItems ?? 40);

const stats = {
  feedsConfigured: config.feeds.length,
  feedsSuccessful: feedStats.filter(x => x.status === "ok").length,
  rawRecentItems: collected.length,
  duplicateStoriesMerged: collected.length - grouped.length,
  finalPautas: ranked.length,
  discardedOrOlderThanHours: maxAgeHours
};

await mkdir(resolve(root, "output"), { recursive: true });
const generatedAt = new Date().toISOString();
const payload = {
  generatedAt,
  filterWindowHours: maxAgeHours,
  stats,
  feedStats,
  editorialStatus: "REVISÃO HUMANA OBRIGATÓRIA",
  items: ranked
};
await writeFile(resolve(root, "output/radar.json"), JSON.stringify(payload, null, 2) + "\n");

const lines = [
  "# Radar SPFC NA ÁREA — versão 2",
  "",
  "Gerado em: " + generatedAt,
  "Janela: últimas " + maxAgeHours + " horas",
  "Pautas finais: " + ranked.length,
  "Duplicatas agrupadas: " + stats.duplicateStoriesMerged,
  "",
  "> FILTRO AUTOMÁTICO: confirme a matéria original, a data, o contexto e a veracidade antes de produzir conteúdo.",
  "",
  "## Resumo das fontes",
  ""
];
for (const stat of feedStats) {
  lines.push("- " + stat.feed + ": " + (stat.status === "ok" ? stat.recentRelevant + " pautas recentes/relevantes de " + stat.read + " itens" : "falha — " + stat.error));
}
lines.push("", "## Pautas priorizadas", "");
ranked.forEach((item, index) => {
  lines.push(
    "### " + (index + 1) + ". [" + item.category + "] " + item.title,
    "",
    "- Pontuação editorial automática: " + item.score,
    "- Publicado: " + item.publishedAt,
    "- Fonte do feed: " + item.source,
    "- Link: " + item.link,
    ...(item.alsoSeenIn.length ? ["- Outras fontes/links sobre o assunto: " + item.alsoSeenIn.map(x => x.source + " — " + x.link).join(" | ")] : []),
    "",
    item.description || "Sem resumo disponível.",
    ""
  );
});
if (!ranked.length) lines.push("Nenhuma pauta recente passou pelos filtros. Isso pode significar ausência de notícias ou filtros muito restritivos.", "");
await writeFile(resolve(root, "output/radar.md"), lines.join("\n"));

console.log("Radar v2 concluído:", JSON.stringify(stats));
