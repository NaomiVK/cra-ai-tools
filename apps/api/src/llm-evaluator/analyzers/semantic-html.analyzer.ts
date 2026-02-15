import type { ParsedPage, AnalyzerResult, ActionableItem } from '@cra-ai-tools/shared-types';

/**
 * Semantic HTML Quality Analyzer
 *
 * Sub-checks (weighted):
 *  - Heading hierarchy (25%)
 *  - Landmark usage (25%)
 *  - Semantic-to-div ratio (20%)
 *  - List structures (15%)
 *  - Table semantics (15%)
 */
export function analyzeSemanticHTML(page: ParsedPage): AnalyzerResult {
  const details: string[] = [];
  const issues: string[] = [];
  const actionableItems: ActionableItem[] = [];

  // --- Heading hierarchy (25%) ---
  let headingScore = 0;
  const { headings } = page;

  if (headings.length === 0) {
    headingScore = 0;
    issues.push('No headings found on the page');
    actionableItems.push({
      priority: 'high',
      category: 'Semantic HTML',
      issue: 'Page has no heading elements',
      recommendation: 'Add a clear heading hierarchy starting with a single <h1> for the page title',
      code_example: '<h1>Page Title</h1>\n<h2>Section</h2>\n<h3>Subsection</h3>',
    });
  } else {
    const h1Count = headings.filter(h => h.level === 1).length;
    if (h1Count === 1) {
      headingScore += 40;
      details.push('Single <h1> found');
    } else if (h1Count === 0) {
      issues.push('No <h1> element found');
      actionableItems.push({
        priority: 'high',
        category: 'Semantic HTML',
        issue: 'Missing <h1> element',
        recommendation: 'Add exactly one <h1> element as the page title',
      });
    } else {
      headingScore += 15;
      issues.push(`Multiple <h1> elements found (${h1Count})`);
      actionableItems.push({
        priority: 'medium',
        category: 'Semantic HTML',
        issue: `${h1Count} <h1> elements found — should be exactly one`,
        recommendation: 'Use a single <h1> for the main title; demote others to <h2>',
      });
    }

    // Check for skipped levels (h1 -> h3 without h2)
    let hasSkips = false;
    for (let i = 1; i < headings.length; i++) {
      if (headings[i].level > headings[i - 1].level + 1) {
        hasSkips = true;
        break;
      }
    }
    if (!hasSkips) {
      headingScore += 40;
      details.push('Heading hierarchy has no skipped levels');
    } else {
      headingScore += 10;
      issues.push('Heading levels are skipped (e.g., h1 → h3)');
      actionableItems.push({
        priority: 'medium',
        category: 'Semantic HTML',
        issue: 'Heading hierarchy skips levels',
        recommendation: 'Ensure headings follow sequential order without skipping levels',
      });
    }

    // Depth — having at least h1, h2, h3 is good
    const uniqueLevels = new Set(headings.map(h => h.level));
    if (uniqueLevels.size >= 3) {
      headingScore += 20;
      details.push(`${uniqueLevels.size} heading levels used`);
    } else {
      headingScore += 10;
    }
  }
  headingScore = Math.min(100, headingScore);

  // --- Landmark usage (25%) ---
  let landmarkScore = 0;
  const landmarkTags = new Set(page.landmarks.map(l => l.tag));

  const expectedLandmarks = ['nav', 'main', 'header', 'footer'];
  let foundCount = 0;
  for (const tag of expectedLandmarks) {
    if (landmarkTags.has(tag)) foundCount++;
  }
  landmarkScore = Math.round((foundCount / expectedLandmarks.length) * 100);

  if (foundCount === expectedLandmarks.length) {
    details.push('All key landmarks present (nav, main, header, footer)');
  } else {
    const missing = expectedLandmarks.filter(t => !landmarkTags.has(t));
    issues.push(`Missing landmark elements: ${missing.join(', ')}`);
    if (!landmarkTags.has('main')) {
      actionableItems.push({
        priority: 'high',
        category: 'Semantic HTML',
        issue: 'No <main> landmark found',
        recommendation: 'Wrap primary content in a <main> element',
        code_example: '<main>\n  <!-- primary page content -->\n</main>',
      });
    }
  }

  // --- Semantic-to-div ratio (20%) ---
  let semanticRatioScore = 0;
  const totalSemantic = page.semanticElements.reduce((sum, e) => sum + e.count, 0);
  const totalContainers = totalSemantic + page.divCount;

  if (totalContainers === 0) {
    semanticRatioScore = 50; // neutral if no containers at all
  } else {
    const ratio = totalSemantic / totalContainers;
    // 40%+ semantic = 100, 0% = 0
    semanticRatioScore = Math.min(100, Math.round(ratio * 250));
    details.push(`Semantic-to-div ratio: ${Math.round(ratio * 100)}% (${totalSemantic} semantic, ${page.divCount} divs)`);

    if (ratio < 0.15) {
      actionableItems.push({
        priority: 'medium',
        category: 'Semantic HTML',
        issue: 'Very low semantic element usage compared to <div>s',
        recommendation: 'Replace generic <div> wrappers with semantic elements like <section>, <article>, <aside>',
      });
    }
  }

  // --- List structures (15%) ---
  let listScore = 0;
  if (page.lists.length > 0) {
    listScore = 60;
    const hasDefinitionList = page.lists.some(l => l.tag === 'dl');
    if (hasDefinitionList) {
      listScore += 20;
      details.push('Definition lists (<dl>) used');
    }
    const hasSubstantialLists = page.lists.some(l => l.itemCount >= 3);
    if (hasSubstantialLists) {
      listScore += 20;
      details.push('Meaningful list structures found');
    }
  } else {
    listScore = 30; // Not all pages need lists, so not a harsh penalty
  }
  listScore = Math.min(100, listScore);

  // --- Table semantics (15%) ---
  let tableScore = 100; // Default high if no tables (tables not always needed)
  if (page.tables.length > 0) {
    let goodTables = 0;
    for (const table of page.tables) {
      let tablePoints = 0;
      if (table.hasHead) tablePoints += 40;
      if (table.hasBody) tablePoints += 30;
      if (table.hasScopeHeaders) tablePoints += 30;
      goodTables += tablePoints;
    }
    tableScore = Math.round(goodTables / page.tables.length);
    details.push(`${page.tables.length} table(s) found`);

    if (tableScore < 70) {
      actionableItems.push({
        priority: 'low',
        category: 'Semantic HTML',
        issue: 'Tables missing proper semantic markup',
        recommendation: 'Add <thead>, <tbody>, and scope attributes to <th> elements',
        code_example: '<table>\n  <thead><tr><th scope="col">Header</th></tr></thead>\n  <tbody><tr><td>Data</td></tr></tbody>\n</table>',
      });
    }
  }

  // Weighted total
  const totalScore = Math.round(
    headingScore * 0.25 +
    landmarkScore * 0.25 +
    semanticRatioScore * 0.20 +
    listScore * 0.15 +
    tableScore * 0.15
  );

  return {
    score: { score: clamp(totalScore), details, issues },
    actionableItems,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
