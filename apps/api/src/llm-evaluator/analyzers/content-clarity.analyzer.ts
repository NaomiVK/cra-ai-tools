import type { ParsedPage, AnalyzerResult, ActionableItem } from '@cra-ai-tools/shared-types';
import {
  fleschKincaidReadingEase,
  averageSentenceLength,
  jargonDensity,
  getWords,
} from '../utils/text-analysis.util';

/**
 * Content Clarity Analyzer
 *
 * Sub-checks (weighted):
 *  - Flesch-Kincaid readability (30%)
 *  - Average sentence length (25%)
 *  - Paragraph length distribution (20%)
 *  - Jargon density (25%)
 */
export function analyzeContentClarity(page: ParsedPage): AnalyzerResult {
  const details: string[] = [];
  const issues: string[] = [];
  const actionableItems: ActionableItem[] = [];

  const fullText = page.paragraphs.join(' ');

  if (fullText.length < 50) {
    return {
      score: { score: 0, details: ['Insufficient text content to analyze'], issues: ['Page has very little paragraph text'] },
      actionableItems: [{
        priority: 'high',
        category: 'Content Clarity',
        issue: 'Page has almost no paragraph text content',
        recommendation: 'Add substantive paragraph content to improve LLM extractability',
      }],
    };
  }

  // --- Flesch-Kincaid readability (30%) ---
  const fkScore = fleschKincaidReadingEase(fullText);
  // FK 60-70 = standard, 70+ = easy, <30 = very difficult
  let readabilityScore: number;
  if (fkScore >= 60) {
    readabilityScore = 100;
  } else if (fkScore >= 40) {
    readabilityScore = 50 + (fkScore - 40) * 2.5;
  } else if (fkScore >= 20) {
    readabilityScore = 20 + (fkScore - 20) * 1.5;
  } else {
    readabilityScore = fkScore;
  }
  details.push(`Flesch-Kincaid Reading Ease: ${fkScore}`);

  if (fkScore < 40) {
    issues.push(`Low readability score (${fkScore}) — content is difficult to read`);
    actionableItems.push({
      priority: 'high',
      category: 'Content Clarity',
      issue: `Flesch-Kincaid score of ${fkScore} indicates very difficult reading level`,
      recommendation: 'Simplify sentence structure and use shorter, more common words',
    });
  }

  // --- Average sentence length (25%) ---
  const avgSentLen = averageSentenceLength(fullText);
  let sentenceLengthScore: number;
  // Ideal: 15-20 words per sentence
  if (avgSentLen >= 12 && avgSentLen <= 22) {
    sentenceLengthScore = 100;
  } else if (avgSentLen < 12) {
    sentenceLengthScore = 60 + avgSentLen * 3.3;
  } else {
    // Penalize long sentences
    sentenceLengthScore = Math.max(0, 100 - (avgSentLen - 22) * 4);
  }
  details.push(`Average sentence length: ${avgSentLen} words`);

  if (avgSentLen > 25) {
    issues.push(`Average sentence length is ${avgSentLen} words — too long`);
    actionableItems.push({
      priority: 'medium',
      category: 'Content Clarity',
      issue: `Average sentence length of ${avgSentLen} words exceeds recommended 20 words`,
      recommendation: 'Break long sentences into shorter ones for better comprehension and LLM extraction',
    });
  }

  // --- Paragraph length distribution (20%) ---
  let paragraphScore = 0;
  if (page.paragraphs.length === 0) {
    paragraphScore = 0;
    issues.push('No paragraphs found');
  } else {
    const paraWordCounts = page.paragraphs.map(p => getWords(p).length);
    const avgParaLen = paraWordCounts.reduce((a, b) => a + b, 0) / paraWordCounts.length;
    const longParas = paraWordCounts.filter(c => c > 150).length;

    details.push(`${page.paragraphs.length} paragraphs, avg ${Math.round(avgParaLen)} words each`);

    // Ideal paragraph length: 40-100 words
    if (avgParaLen >= 30 && avgParaLen <= 120) {
      paragraphScore = 100;
    } else if (avgParaLen < 30) {
      paragraphScore = 60;
    } else {
      paragraphScore = Math.max(20, 100 - (avgParaLen - 120));
    }

    if (longParas > 0) {
      paragraphScore = Math.max(0, paragraphScore - longParas * 10);
      issues.push(`${longParas} paragraph(s) exceed 150 words`);
      actionableItems.push({
        priority: 'low',
        category: 'Content Clarity',
        issue: `${longParas} very long paragraph(s) found`,
        recommendation: 'Break paragraphs longer than 150 words into smaller chunks',
      });
    }
  }

  // --- Jargon density (25%) ---
  const jargon = jargonDensity(fullText);
  let jargonScore: number;
  // 0 jargon per 100 words = 100, 5+ = 0
  if (jargon <= 0.5) {
    jargonScore = 100;
  } else if (jargon <= 2) {
    jargonScore = 80 - (jargon - 0.5) * 20;
  } else {
    jargonScore = Math.max(0, 50 - (jargon - 2) * 16);
  }
  details.push(`Jargon density: ${jargon} per 100 words`);

  if (jargon > 2) {
    issues.push(`High jargon density: ${jargon} per 100 words`);
    actionableItems.push({
      priority: 'medium',
      category: 'Content Clarity',
      issue: `Jargon density of ${jargon} per 100 words is high`,
      recommendation: 'Replace formal/bureaucratic terms with plain language equivalents',
    });
  }

  // Weighted total
  const totalScore = Math.round(
    readabilityScore * 0.30 +
    sentenceLengthScore * 0.25 +
    paragraphScore * 0.20 +
    jargonScore * 0.25
  );

  return {
    score: { score: clamp(totalScore), details, issues },
    actionableItems,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
