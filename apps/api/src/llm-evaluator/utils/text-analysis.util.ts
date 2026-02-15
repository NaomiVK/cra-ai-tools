/**
 * Count syllables in an English word using a simple heuristic.
 */
export function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 2) return 1;

  // Remove trailing silent e
  word = word.replace(/e$/, '');

  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  const count = vowelGroups ? vowelGroups.length : 1;
  return Math.max(1, count);
}

/**
 * Count total syllables in a text.
 */
export function totalSyllables(text: string): number {
  const words = getWords(text);
  return words.reduce((sum, w) => sum + countSyllables(w), 0);
}

/**
 * Extract words from text.
 */
export function getWords(text: string): string[] {
  return text.match(/[a-zA-Z']+/g) || [];
}

/**
 * Split text into sentences.
 */
export function splitSentences(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Flesch-Kincaid Reading Ease score.
 * Higher = easier to read. Range roughly 0-100.
 * Formula: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
 */
export function fleschKincaidReadingEase(text: string): number {
  const sentences = splitSentences(text);
  const words = getWords(text);
  if (sentences.length === 0 || words.length === 0) return 0;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables(text) / words.length;

  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/**
 * Flesch-Kincaid Grade Level.
 * Lower = easier to read.
 */
export function fleschKincaidGradeLevel(text: string): number {
  const sentences = splitSentences(text);
  const words = getWords(text);
  if (sentences.length === 0 || words.length === 0) return 0;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = totalSyllables(text) / words.length;

  const grade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

/**
 * Common jargon / bureaucratic terms often found on government sites.
 */
const JARGON_PATTERNS = [
  /\bhereby\b/i, /\bwherein\b/i, /\bthereof\b/i, /\bpursuant\b/i,
  /\bnotwithstanding\b/i, /\baforementioned\b/i, /\bheretofore\b/i,
  /\bin accordance with\b/i, /\bwith respect to\b/i, /\bfor the purpose of\b/i,
  /\bin lieu of\b/i, /\bin the event that\b/i, /\bsubject to\b/i,
  /\bshall be\b/i, /\bmay be\b/i, /\bis deemed\b/i,
  /\butilize\b/i, /\bfacilitate\b/i, /\bcommence\b/i,
  /\bterminate\b/i, /\bimplement\b/i, /\bascertain\b/i,
  /\bendeavour\b/i, /\bendeavor\b/i, /\bremuneration\b/i,
];

/**
 * Count jargon terms per 100 words.
 */
export function jargonDensity(text: string): number {
  const words = getWords(text);
  if (words.length === 0) return 0;

  let jargonCount = 0;
  for (const pattern of JARGON_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, 'gi'));
    if (matches) jargonCount += matches.length;
  }

  return Math.round((jargonCount / words.length) * 100 * 100) / 100;
}

/**
 * Average sentence length in words.
 */
export function averageSentenceLength(text: string): number {
  const sentences = splitSentences(text);
  const words = getWords(text);
  if (sentences.length === 0) return 0;
  return Math.round((words.length / sentences.length) * 10) / 10;
}
