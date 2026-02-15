import type { ParsedPage, AnalyzerResult, ActionableItem } from '@cra-ai-tools/shared-types';

/**
 * Citation Markers Analyzer
 *
 * Sub-checks (weighted):
 *  - Date metadata (25%)
 *  - Author attribution (20%)
 *  - External link quality (20%)
 *  - Source references (20%)
 *  - Inline citations / footnotes (15%)
 */
export function analyzeCitationMarkers(page: ParsedPage): AnalyzerResult {
  const details: string[] = [];
  const issues: string[] = [];
  const actionableItems: ActionableItem[] = [];

  // --- Date metadata (25%) ---
  let dateScore = 0;
  const dateIndicators = [
    page.metaTags['article:published_time'],
    page.metaTags['date'],
    page.metaTags['dcterms.date'],
    page.metaTags['dcterms.modified'],
    page.metaTags['dcterms.created'],
    page.openGraph['article:published_time'],
    page.openGraph['article:modified_time'],
  ].filter(Boolean);

  // Check JSON-LD for datePublished / dateModified
  const jsonLdDates = page.jsonLd.some((ld: any) =>
    ld['datePublished'] || ld['dateModified'] ||
    (Array.isArray(ld['@graph']) && ld['@graph'].some((item: any) => item['datePublished'] || item['dateModified']))
  );

  if (dateIndicators.length > 0 || jsonLdDates) {
    dateScore = 100;
    details.push('Publication/modification date metadata found');
    if (dateIndicators.length > 1 || jsonLdDates) {
      details.push('Multiple date signals present');
    }
  } else {
    // Check for visible date patterns in text (e.g., "Published: Jan 2024")
    const datePattern = /(?:published|updated|modified|date)[:\s]*\d{1,2}[\s,/-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2})[\s,/-]+\d{2,4}/i;
    const hasVisibleDate = datePattern.test(page.textContent);
    if (hasVisibleDate) {
      dateScore = 50;
      details.push('Date found in visible text but not in metadata');
      actionableItems.push({
        priority: 'medium',
        category: 'Citation Markers',
        issue: 'Date is only in visible text, not in structured metadata',
        recommendation: 'Add date metadata using <meta> tags or JSON-LD datePublished/dateModified',
        code_example: '<meta name="dcterms.date" content="2024-01-15">',
      });
    } else {
      dateScore = 0;
      issues.push('No date metadata or visible dates found');
      actionableItems.push({
        priority: 'high',
        category: 'Citation Markers',
        issue: 'No publication or modification date found',
        recommendation: 'Add date metadata so LLMs can assess content freshness',
        code_example: '<script type="application/ld+json">\n{"@type": "WebPage", "datePublished": "2024-01-15", "dateModified": "2024-06-01"}\n</script>',
      });
    }
  }

  // --- Author attribution (20%) ---
  let authorScore = 0;
  const hasAuthorMeta = !!page.metaTags['author'];
  const hasAuthorSchema = page.jsonLd.some((ld: any) =>
    ld['author'] ||
    (Array.isArray(ld['@graph']) && ld['@graph'].some((item: any) => item['author']))
  );

  if (hasAuthorMeta && hasAuthorSchema) {
    authorScore = 100;
    details.push('Author found in both meta tags and structured data');
  } else if (hasAuthorMeta || hasAuthorSchema) {
    authorScore = 70;
    details.push('Author attribution found');
  } else {
    // Check for visible "by" attribution
    const bylinePattern = /\b(?:by|author|written by)[:\s]+[A-Z][a-z]+/i;
    if (bylinePattern.test(page.textContent)) {
      authorScore = 30;
      details.push('Author byline found in visible text only');
    } else {
      authorScore = 0;
      issues.push('No author attribution found');
      actionableItems.push({
        priority: 'medium',
        category: 'Citation Markers',
        issue: 'No author attribution on the page',
        recommendation: 'Add author metadata for credibility and citation',
        code_example: '<meta name="author" content="Author Name">',
      });
    }
  }

  // --- External link quality (20%) ---
  let externalLinkScore = 0;
  const externalLinks = page.links.filter(l => l.isExternal);

  if (externalLinks.length >= 3) {
    externalLinkScore = 80;
    // Check if links have meaningful text (not just "click here")
    const meaningfulLinks = externalLinks.filter(l =>
      l.text.length > 5 && !/^(click here|here|link|read more)$/i.test(l.text)
    );
    if (meaningfulLinks.length >= externalLinks.length * 0.6) {
      externalLinkScore = 100;
      details.push(`${externalLinks.length} external links with descriptive text`);
    } else {
      details.push(`${externalLinks.length} external links, some with poor anchor text`);
      actionableItems.push({
        priority: 'low',
        category: 'Citation Markers',
        issue: 'Some external links use non-descriptive anchor text',
        recommendation: 'Use descriptive link text that indicates the destination content',
      });
    }
  } else if (externalLinks.length > 0) {
    externalLinkScore = 40;
    details.push(`Only ${externalLinks.length} external link(s)`);
  } else {
    externalLinkScore = 0;
    issues.push('No external links found');
  }

  // --- Source references (20%) ---
  let sourceRefScore = 0;
  // Look for reference sections, bibliography, footnotes
  const refPatterns = [
    /references/i, /bibliography/i, /sources/i, /further reading/i, /see also/i,
  ];
  const hasRefSection = page.headings.some(h =>
    refPatterns.some(p => p.test(h.text))
  );

  // Look for inline citation patterns like [1], (Smith, 2023)
  const citationPattern = /\[\d+\]|\([A-Z][a-z]+,?\s*\d{4}\)/;
  const hasInlineCitations = citationPattern.test(page.textContent);

  if (hasRefSection) {
    sourceRefScore = 100;
    details.push('Reference/source section found');
  } else if (hasInlineCitations) {
    sourceRefScore = 60;
    details.push('Inline citations detected');
  } else {
    sourceRefScore = 20;
    // Not every page needs references, so lighter penalty
  }

  // --- Inline citations / footnotes (15%) ---
  let footnoteScore = 0;
  // Check for sup/sub with links (typical footnote pattern)
  const hasFootnotePatterns = /\[\d+\]|<sup>.*?<\/sup>|class="footnote"/i.test(page.html);

  if (hasInlineCitations && hasFootnotePatterns) {
    footnoteScore = 100;
    details.push('Footnote markup detected');
  } else if (hasInlineCitations) {
    footnoteScore = 60;
  } else {
    footnoteScore = 20; // neutral
  }

  // Weighted total
  const totalScore = Math.round(
    dateScore * 0.25 +
    authorScore * 0.20 +
    externalLinkScore * 0.20 +
    sourceRefScore * 0.20 +
    footnoteScore * 0.15
  );

  return {
    score: { score: clamp(totalScore), details, issues },
    actionableItems,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
