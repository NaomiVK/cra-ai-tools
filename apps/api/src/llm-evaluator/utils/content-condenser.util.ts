import type { ParsedPage } from '@cra-ai-tools/shared-types';

const MAX_TOTAL = 12_000;

/**
 * Condenses a ParsedPage into a structured text summary suitable for LLM evaluation.
 * Targets ~12K characters to fit within model context limits while preserving
 * the most important signals for evaluating LLM readability.
 */
export function condensePage(page: ParsedPage): string {
  const sections: string[] = [];

  // 1. Title + meta description + author (~200 chars)
  const meta = page.metaTags;
  sections.push(
    `=== PAGE IDENTITY ===\n` +
    `Title: ${page.title || '(none)'}\n` +
    `Description: ${meta['description'] || meta['og:description'] || '(none)'}\n` +
    `Author: ${meta['author'] || '(none)'}`
  );

  // 2. Heading outline, first 30 headings (~500 chars)
  if (page.headings.length > 0) {
    const headingLines = page.headings.slice(0, 30).map(
      (h) => `${'  '.repeat(h.level - 1)}H${h.level}: ${h.text}`
    );
    sections.push(
      `=== HEADING OUTLINE (${page.headings.length} total) ===\n` +
      headingLines.join('\n')
    );
  }

  // 3. Structured data summary (~500 chars)
  const structuredParts: string[] = [];
  if (page.jsonLd.length > 0) {
    const types = page.jsonLd
      .map((j: Record<string, unknown>) => (j as { '@type'?: string })['@type'] || 'unknown')
      .join(', ');
    structuredParts.push(`JSON-LD types: ${types}`);
  }
  if (Object.keys(page.openGraph).length > 0) {
    const ogEntries = Object.entries(page.openGraph)
      .slice(0, 10)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    structuredParts.push(`OpenGraph: ${ogEntries}`);
  }
  if (page.microdata.length > 0) {
    structuredParts.push(`Microdata types: ${page.microdata.map((m) => m.type).join(', ')}`);
  }
  if (structuredParts.length > 0) {
    sections.push(`=== STRUCTURED DATA ===\n${structuredParts.join('\n')}`);
  }

  // 4. Semantic structure: landmarks, element counts (~200 chars)
  const structureParts: string[] = [];
  if (page.landmarks.length > 0) {
    structureParts.push(
      `Landmarks: ${page.landmarks.map((l) => l.role || l.tag).join(', ')}`
    );
  }
  const semanticSummary = page.semanticElements
    .slice(0, 10)
    .map((e) => `${e.tag}(${e.count})`)
    .join(', ');
  if (semanticSummary) {
    structureParts.push(`Semantic elements: ${semanticSummary}`);
  }
  structureParts.push(`Divs: ${page.divCount}`);
  if (page.lists.length > 0) {
    structureParts.push(`Lists: ${page.lists.length} (items: ${page.lists.reduce((s, l) => s + l.itemCount, 0)})`);
  }
  if (page.tables.length > 0) {
    structureParts.push(`Tables: ${page.tables.length}`);
  }
  sections.push(`=== SEMANTIC STRUCTURE ===\n${structureParts.join('\n')}`);

  // 5. Content excerpt: first N paragraphs up to budget
  const usedSoFar = sections.join('\n\n').length;
  const contentBudget = Math.max(2000, MAX_TOTAL - usedSoFar - 500); // reserve 500 for footer sections
  let contentExcerpt = '';
  for (const para of page.paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (contentExcerpt.length + trimmed.length + 2 > contentBudget) break;
    contentExcerpt += trimmed + '\n\n';
  }
  if (contentExcerpt) {
    sections.push(`=== CONTENT EXCERPT ===\n${contentExcerpt.trimEnd()}`);
  }

  // 6. Link summary (~200 chars)
  const internalLinks = page.links.filter((l) => !l.isExternal);
  const externalLinks = page.links.filter((l) => l.isExternal);
  const sampleExternal = externalLinks
    .slice(0, 5)
    .map((l) => `${l.text || '(no text)'} → ${l.href}`)
    .join('; ');
  sections.push(
    `=== LINKS ===\n` +
    `Internal: ${internalLinks.length}, External: ${externalLinks.length}\n` +
    (sampleExternal ? `Sample external: ${sampleExternal}` : '')
  );

  // 7. Stats footer (~100 chars)
  sections.push(
    `=== STATS ===\n` +
    `Total chars: ${page.totalTextLength}, ` +
    `Sentences: ${page.sentences.length}, ` +
    `Paragraphs: ${page.paragraphs.length}`
  );

  return sections.join('\n\n').slice(0, MAX_TOTAL);
}
