import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { ParsedPage } from '@cra-ai-tools/shared-types';

const LANDMARK_TAGS = ['nav', 'main', 'aside', 'footer', 'header', 'section', 'article'];
const SEMANTIC_TAGS = ['article', 'section', 'aside', 'nav', 'header', 'footer', 'main', 'figure', 'figcaption', 'details', 'summary', 'mark', 'time', 'address', 'blockquote', 'cite', 'code', 'pre', 'dl', 'dt', 'dd'];

export function parseHTML(html: string, baseUrl?: string): ParsedPage {
  const $ = cheerio.load(html);

  const title = $('title').first().text().trim();

  // Headings
  const headings: ParsedPage['headings'] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = (el as Element).tagName;
    headings.push({ level: parseInt(tag[1]), text: $(el).text().trim() });
  });

  // Landmarks
  const landmarks: ParsedPage['landmarks'] = [];
  LANDMARK_TAGS.forEach(tag => {
    $(tag).each((_, el) => {
      landmarks.push({ tag, role: $(el).attr('role') });
    });
  });
  // Also pick up role="..." landmarks on divs
  $('[role]').each((_, el) => {
    const role = $(el).attr('role');
    const tag = (el as Element).tagName;
    if (role && !LANDMARK_TAGS.includes(tag)) {
      landmarks.push({ tag, role });
    }
  });

  // Semantic elements count
  const semanticCounts = new Map<string, number>();
  SEMANTIC_TAGS.forEach(tag => {
    const count = $(tag).length;
    if (count > 0) semanticCounts.set(tag, count);
  });
  const semanticElements = Array.from(semanticCounts.entries()).map(([tag, count]) => ({ tag, count }));

  const divCount = $('div').length;

  // Lists
  const lists: ParsedPage['lists'] = [];
  $('ul, ol, dl').each((_, el) => {
    const tag = (el as Element).tagName;
    const itemCount = tag === 'dl' ? $(el).children('dt').length : $(el).children('li').length;
    lists.push({ tag, itemCount });
  });

  // Tables
  const tables: ParsedPage['tables'] = [];
  $('table').each((_, el) => {
    tables.push({
      hasHead: $(el).find('thead').length > 0,
      hasBody: $(el).find('tbody').length > 0,
      hasScopeHeaders: $(el).find('th[scope]').length > 0,
    });
  });

  // JSON-LD
  const jsonLd: object[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || '');
      jsonLd.push(parsed);
    } catch { /* ignore malformed */ }
  });

  // Microdata
  const microdata: { type: string }[] = [];
  $('[itemtype]').each((_, el) => {
    microdata.push({ type: $(el).attr('itemtype') || '' });
  });

  // OpenGraph
  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property');
    const content = $(el).attr('content');
    if (prop && content) openGraph[prop] = content;
  });

  // Meta tags
  const metaTags: Record<string, string> = {};
  $('meta[name]').each((_, el) => {
    const name = $(el).attr('name');
    const content = $(el).attr('content');
    if (name && content) metaTags[name] = content;
  });

  // Links
  const links: ParsedPage['links'] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    let isExternal = false;
    try {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        if (baseUrl) {
          const linkHost = new URL(href).hostname;
          const baseHost = new URL(baseUrl).hostname;
          isExternal = linkHost !== baseHost;
        } else {
          isExternal = true;
        }
      }
    } catch { /* malformed URL */ }
    links.push({ href, text, isExternal });
  });

  // Remove script/style for text extraction
  $('script, style, noscript').remove();

  // Paragraphs
  const paragraphs: string[] = [];
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 0) paragraphs.push(text);
  });

  // Full text content
  const textContent = $('body').text().replace(/\s+/g, ' ').trim();

  // Sentences from paragraphs
  const allParaText = paragraphs.join(' ');
  const sentences = splitSentences(allParaText);

  // Navigation vs main content text lengths
  let navTextLength = 0;
  $('nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"]').each((_, el) => {
    navTextLength += $(el).text().trim().length;
  });

  let mainTextLength = 0;
  const mainEl = $('main, [role="main"], article');
  if (mainEl.length > 0) {
    mainEl.each((_, el) => {
      mainTextLength += $(el).text().trim().length;
    });
  } else {
    mainTextLength = textContent.length - navTextLength;
  }

  return {
    html,
    title,
    headings,
    landmarks,
    semanticElements,
    divCount,
    lists,
    tables,
    jsonLd,
    microdata,
    openGraph,
    metaTags,
    links,
    paragraphs,
    sentences,
    textContent,
    navTextLength,
    mainTextLength,
    totalTextLength: textContent.length,
  };
}

function splitSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
