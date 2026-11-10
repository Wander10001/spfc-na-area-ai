import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const config = JSON.parse(await readFile(resolve(root, "config/feeds.json"), "utf8"));

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

const items = [];
for (const feed of config.feeds) {
  try {
    const response = await fetch(feed.url, {
      headers: { "user-agent": "SPFC-NA-AREA-Radar/0.1" },
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const xml = await response.text();
    const blocks = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(match => match[1]);

    for (const block of blocks) {
      const title = getTag(block, "title");
      const link = getTag(block, "link") || (block.match(/<link[^>]*href=["']([^"']+)/i)?.[1] ?? "");
      const description = getTag(block, "description");
      const publishedAt = getTag(block, "pubDate");
      const searchable = (title + " " + description).toLocaleLowerCase("pt-BR");
      if (!config.keywords.some(word => searchable.includes(word))) continue;
      if (config.exclude.some(word => searchable.includes(word))) continue;
      items.push({ title, link, description, publishedAt, source: feed.name });
    }
    console.log("OK:", feed.name, "-", blocks.length, "itens lidos");
  } catch (error) {
    console.warn("Falha no feed:", feed.name, "-", error.message);
  }
}

const unique = [...new Map(items.filter(item => item.title && item.link).map(item => [item.link, item])).values()]
  .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));

await mkdir(resolve(root, "output"), { recursive: true });
const generatedAt = new Date().toISOString();
const payload = {
  generatedAt,
  total: unique.length,
  editorialStatus: "REVISÃO HUMANA OBRIGATÓRIA",
  items: unique
};
await writeFile(resolve(root, "output/radar.json"), JSON.stringify(payload, null, 2) + "\n");

const lines = [
  "# Radar SPFC NA ÁREA",
  "",
  "Gerado em: " + generatedAt,
  "Pautas encontradas: " + unique.length,
  "",
  "> ATENÇÃO: resultados automáticos. Abra a fonte original e confirme data, contexto e veracidade antes de usar.",
  ""
];

unique.forEach((item, index) => {
  lines.push(
    "## " + (index + 1) + ". " + item.title,
    "",
    "- Fonte do feed: " + item.source,
    "- Publicado: " + (item.publishedAt || "data não informada"),
    "- Link: " + item.link,
    "",
    item.description || "Sem resumo disponível.",
    ""
  );
});

if (!unique.length) lines.push("Nenhuma pauta passou pelos filtros nesta execução.", "");
await writeFile(resolve(root, "output/radar.md"), lines.join("\n"));
console.log("Radar concluído:", unique.length, "pautas únicas.");
