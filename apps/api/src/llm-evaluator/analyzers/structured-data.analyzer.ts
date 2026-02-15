import type { ParsedPage, AnalyzerResult, ActionableItem } from '@cra-ai-tools/shared-types';

/**
 * Structured Data Analyzer
 *
 * Sub-checks (weighted):
 *  - JSON-LD / Schema.org (30%)
 *  - Microdata (15%)
 *  - OpenGraph tags (25%)
 *  - Breadcrumb markup (15%)
 *  - Article/Author metadata (15%)
 */
export function analyzeStructuredData(page: ParsedPage): AnalyzerResult {
  const details: string[] = [];
  const issues: string[] = [];
  const actionableItems: ActionableItem[] = [];

  // --- JSON-LD / Schema.org (30%) ---
  let jsonLdScore = 0;
  if (page.jsonLd.length > 0) {
    jsonLdScore = 70;
    details.push(`${page.jsonLd.length} JSON-LD block(s) found`);

    // Check for common types
    const types = page.jsonLd
      .map((ld: any) => ld['@type'])
      .filter(Boolean)
      .flat();
    if (types.length > 0) {
      jsonLdScore = 100;
      details.push(`Schema types: ${types.join(', ')}`);
    }
  } else {
    issues.push('No JSON-LD structured data found');
    actionableItems.push({
      priority: 'high',
      category: 'Structured Data',
      issue: 'No JSON-LD structured data on the page',
      recommendation: 'Add JSON-LD markup for the primary content type (Organization, WebPage, Article, etc.)',
      code_example: '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "Page Title",\n  "description": "Page description"\n}\n</script>',
    });
  }

  // --- Microdata (15%) ---
  let microdataScore = 0;
  if (page.microdata.length > 0) {
    microdataScore = 100;
    details.push(`${page.microdata.length} microdata item(s) found`);
  } else {
    // Not penalized heavily — JSON-LD is preferred
    microdataScore = 40;
  }

  // --- OpenGraph tags (25%) ---
  let ogScore = 0;
  const ogKeys = Object.keys(page.openGraph);
  const essentialOg = ['og:title', 'og:description', 'og:type', 'og:url'];
  const foundOg = essentialOg.filter(k => ogKeys.includes(k));

  if (foundOg.length === essentialOg.length) {
    ogScore = 100;
    details.push('All essential OpenGraph tags present');
  } else if (foundOg.length > 0) {
    ogScore = Math.round((foundOg.length / essentialOg.length) * 80);
    const missingOg = essentialOg.filter(k => !ogKeys.includes(k));
    issues.push(`Missing OpenGraph tags: ${missingOg.join(', ')}`);
  } else {
    ogScore = 0;
    issues.push('No OpenGraph tags found');
    actionableItems.push({
      priority: 'medium',
      category: 'Structured Data',
      issue: 'No OpenGraph meta tags found',
      recommendation: 'Add OpenGraph tags for better LLM and social media discovery',
      code_example: '<meta property="og:title" content="Page Title">\n<meta property="og:description" content="Description">\n<meta property="og:type" content="website">\n<meta property="og:url" content="https://example.com/page">',
    });
  }

  // Check for og:image as a bonus
  if (ogKeys.includes('og:image')) {
    details.push('og:image tag present');
  }

  // --- Breadcrumb markup (15%) ---
  let breadcrumbScore = 0;
  const hasBreadcrumbSchema = page.jsonLd.some((ld: any) =>
    ld['@type'] === 'BreadcrumbList' ||
    (Array.isArray(ld['@graph']) && ld['@graph'].some((item: any) => item['@type'] === 'BreadcrumbList'))
  );
  const hasBreadcrumbMicrodata = page.microdata.some(m =>
    m.type.includes('BreadcrumbList')
  );
  const hasBreadcrumbNav = page.landmarks.some(l =>
    l.role === 'navigation' || l.tag === 'nav'
  );

  if (hasBreadcrumbSchema || hasBreadcrumbMicrodata) {
    breadcrumbScore = 100;
    details.push('Breadcrumb structured data found');
  } else if (hasBreadcrumbNav) {
    breadcrumbScore = 40;
    details.push('Navigation landmark found (but no breadcrumb schema)');
  } else {
    breadcrumbScore = 0;
    actionableItems.push({
      priority: 'low',
      category: 'Structured Data',
      issue: 'No breadcrumb markup found',
      recommendation: 'Add BreadcrumbList schema for site hierarchy',
    });
  }

  // --- Article/Author metadata (15%) ---
  let authorScore = 0;
  const hasAuthorMeta = !!page.metaTags['author'];
  const hasArticleDate = !!page.metaTags['article:published_time'] || !!page.openGraph['article:published_time'];
  const hasDescription = !!page.metaTags['description'];

  const hasAuthorSchema = page.jsonLd.some((ld: any) =>
    ld['author'] || ld['creator'] ||
    (Array.isArray(ld['@graph']) && ld['@graph'].some((item: any) => item['author']))
  );

  if (hasAuthorMeta || hasAuthorSchema) {
    authorScore += 40;
    details.push('Author attribution found');
  } else {
    issues.push('No author metadata found');
  }

  if (hasDescription) {
    authorScore += 30;
    details.push('Meta description present');
  } else {
    issues.push('No meta description found');
    actionableItems.push({
      priority: 'high',
      category: 'Structured Data',
      issue: 'No meta description tag',
      recommendation: 'Add a concise meta description summarizing the page content',
      code_example: '<meta name="description" content="A concise summary of the page content.">',
    });
  }

  if (hasArticleDate) {
    authorScore += 30;
    details.push('Article publication date found');
  }
  authorScore = Math.min(100, authorScore);

  // Weighted total
  const totalScore = Math.round(
    jsonLdScore * 0.30 +
    microdataScore * 0.15 +
    ogScore * 0.25 +
    breadcrumbScore * 0.15 +
    authorScore * 0.15
  );

  return {
    score: { score: clamp(totalScore), details, issues },
    actionableItems,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
