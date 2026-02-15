import type { ParsedPage, AnalyzerResult, ActionableItem } from '@cra-ai-tools/shared-types';
import { getWords } from '../utils/text-analysis.util';

/**
 * Factual Density Analyzer
 *
 * Sub-checks (weighted):
 *  - Content-to-navigation ratio (30%)
 *  - Text-to-fluff ratio (25%)
 *  - Information density (25%)
 *  - Boilerplate detection (20%)
 */
export function analyzeFactualDensity(page: ParsedPage): AnalyzerResult {
  const details: string[] = [];
  const issues: string[] = [];
  const actionableItems: ActionableItem[] = [];

  if (page.totalTextLength < 50) {
    return {
      score: { score: 0, details: ['Insufficient text content'], issues: ['Page has very little text'] },
      actionableItems: [{
        priority: 'high',
        category: 'Factual Density',
        issue: 'Page has almost no text content',
        recommendation: 'Add substantive content to improve LLM value',
      }],
    };
  }

  // --- Content-to-navigation ratio (30%) ---
  let contentNavScore = 0;
  const contentRatio = page.mainTextLength / page.totalTextLength;

  if (contentRatio >= 0.6) {
    contentNavScore = 100;
    details.push(`Content-to-total ratio: ${Math.round(contentRatio * 100)}%`);
  } else if (contentRatio >= 0.4) {
    contentNavScore = 60 + (contentRatio - 0.4) * 200;
    details.push(`Content-to-total ratio: ${Math.round(contentRatio * 100)}%`);
  } else {
    contentNavScore = Math.round(contentRatio * 150);
    issues.push(`Low content-to-navigation ratio: ${Math.round(contentRatio * 100)}%`);
    actionableItems.push({
      priority: 'high',
      category: 'Factual Density',
      issue: `Only ${Math.round(contentRatio * 100)}% of page text is main content`,
      recommendation: 'Reduce navigation/boilerplate text or increase substantive content',
    });
  }

  // --- Text-to-fluff ratio (25%) ---
  let fluffScore = 0;
  const paragraphText = page.paragraphs.join(' ');
  const paragraphWords = getWords(paragraphText);

  // "Fluff" = filler phrases, vague language
  const fluffPatterns = [
    /\bvery\b/gi, /\breally\b/gi, /\bjust\b/gi, /\bbasically\b/gi,
    /\bactually\b/gi, /\bliterally\b/gi, /\bin order to\b/gi,
    /\bat the end of the day\b/gi, /\bgoing forward\b/gi,
    /\bit is important to note\b/gi, /\bit should be noted\b/gi,
    /\bneedless to say\b/gi, /\bas a matter of fact\b/gi,
    /\bin terms of\b/gi, /\bwith regard to\b/gi,
    /\bat this point in time\b/gi, /\bdue to the fact that\b/gi,
  ];

  let fluffCount = 0;
  for (const pattern of fluffPatterns) {
    const matches = paragraphText.match(pattern);
    if (matches) fluffCount += matches.length;
  }

  const fluffPer100 = paragraphWords.length > 0
    ? Math.round((fluffCount / paragraphWords.length) * 100 * 100) / 100
    : 0;

  if (fluffPer100 <= 1) {
    fluffScore = 100;
  } else if (fluffPer100 <= 3) {
    fluffScore = 70;
  } else {
    fluffScore = Math.max(0, 50 - (fluffPer100 - 3) * 10);
  }
  details.push(`Filler phrases: ${fluffPer100} per 100 words`);

  if (fluffPer100 > 3) {
    issues.push(`High filler phrase density: ${fluffPer100} per 100 words`);
    actionableItems.push({
      priority: 'low',
      category: 'Factual Density',
      issue: 'Content contains excessive filler phrases',
      recommendation: 'Remove vague qualifiers and filler phrases to increase information density',
    });
  }

  // --- Information density (25%) ---
  let infoDensityScore = 0;

  // Heuristic: count "factual signals" — numbers, dates, proper nouns, specific terms
  const numberPattern = /\b\d[\d,.]*\b/g;
  const datePattern = /\b(?:19|20)\d{2}\b/g;
  const numbers = paragraphText.match(numberPattern) || [];
  const dates = paragraphText.match(datePattern) || [];

  const factSignals = numbers.length + dates.length;
  const factsPer100 = paragraphWords.length > 0
    ? Math.round((factSignals / paragraphWords.length) * 100 * 100) / 100
    : 0;

  if (factsPer100 >= 3) {
    infoDensityScore = 100;
  } else if (factsPer100 >= 1) {
    infoDensityScore = 50 + factsPer100 * 25;
  } else {
    infoDensityScore = Math.round(factsPer100 * 50);
  }
  details.push(`Factual signals (numbers/dates): ${factsPer100} per 100 words`);

  // --- Boilerplate detection (20%) ---
  let boilerplateScore = 100;

  // Common boilerplate phrases on government/CRA pages
  const boilerplatePatterns = [
    /skip to (main )?content/gi,
    /all rights reserved/gi,
    /privacy policy/gi,
    /terms (of use|and conditions)/gi,
    /cookie (policy|notice|consent)/gi,
    /copyright ©/gi,
    /follow us on/gi,
    /sign up for (our )?newsletter/gi,
    /subscribe to/gi,
  ];

  let boilerplateCount = 0;
  for (const pattern of boilerplatePatterns) {
    const matches = page.textContent.match(pattern);
    if (matches) boilerplateCount += matches.length;
  }

  // Also check ratio of unique paragraphs
  const uniqueParagraphs = new Set(page.paragraphs.map(p => p.toLowerCase().trim()));
  const dupeRatio = page.paragraphs.length > 0
    ? 1 - uniqueParagraphs.size / page.paragraphs.length
    : 0;

  if (boilerplateCount > 5 || dupeRatio > 0.2) {
    boilerplateScore = 30;
    issues.push('Significant boilerplate or duplicate content detected');
    actionableItems.push({
      priority: 'medium',
      category: 'Factual Density',
      issue: 'Page contains significant boilerplate content',
      recommendation: 'Use <main> to clearly delineate primary content from boilerplate',
    });
  } else if (boilerplateCount > 2) {
    boilerplateScore = 60;
    details.push('Some standard boilerplate detected');
  } else {
    details.push('Low boilerplate content');
  }

  // Weighted total
  const totalScore = Math.round(
    contentNavScore * 0.30 +
    fluffScore * 0.25 +
    infoDensityScore * 0.25 +
    boilerplateScore * 0.20
  );

  return {
    score: { score: clamp(totalScore), details, issues },
    actionableItems,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
