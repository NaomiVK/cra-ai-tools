import * as fs from 'fs';
import * as path from 'path';
import type {
  BatchResultRow,
  BatchResultsQuery,
  BatchQuestion,
} from '@cra-ai-tools/shared-types';

const CSV_HEADERS = [
  'timestamp',
  'question_id',
  'question_text',
  'model_name',
  'search_enabled',
  'search_actually_used',
  'response_text',
  'response_tokens',
  'latency_ms',
  'error',
] as const;

function escapeField(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsvLine(row: BatchResultRow): string {
  return [
    escapeField(row.timestamp),
    escapeField(row.question_id),
    escapeField(row.question_text),
    escapeField(row.model_name),
    String(row.search_enabled),
    String(row.search_actually_used),
    escapeField(row.response_text),
    String(row.response_tokens),
    String(row.latency_ms),
    escapeField(row.error),
  ].join(',');
}

/**
 * Split CSV content into complete records, respecting quoted fields
 * that may contain newlines.
 */
function splitCsvRecords(content: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          current += '""';
          i++;
        } else {
          inQuotes = false;
          current += char;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        current += char;
      } else if (char === '\n') {
        if (current.trim()) {
          records.push(current);
        }
        current = '';
      } else if (char === '\r') {
        // skip carriage returns
      } else {
        current += char;
      }
    }
  }
  if (current.trim()) {
    records.push(current);
  }
  return records;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current);
  return fields;
}

function lineToRow(fields: string[]): BatchResultRow | null {
  if (fields.length < 10) return null;
  return {
    timestamp: fields[0],
    question_id: fields[1],
    question_text: fields[2],
    model_name: fields[3] as BatchResultRow['model_name'],
    search_enabled: fields[4] === 'true',
    search_actually_used: fields[5] === 'true',
    response_text: fields[6],
    response_tokens: parseInt(fields[7], 10) || 0,
    latency_ms: parseInt(fields[8], 10) || 0,
    error: fields[9],
  };
}

export function ensureDataDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function appendToCsv(filePath: string, rows: BatchResultRow[]): void {
  ensureDataDir(filePath);
  const fileExists = fs.existsSync(filePath);

  if (!fileExists) {
    fs.writeFileSync(filePath, CSV_HEADERS.join(',') + '\n', 'utf-8');
  }

  const lines = rows.map((row) => rowToCsvLine(row)).join('\n') + '\n';
  fs.appendFileSync(filePath, lines, 'utf-8');
}

export function readCsv(
  filePath: string,
  query: BatchResultsQuery
): { rows: BatchResultRow[]; total: number; filtered_total: number } {
  if (!fs.existsSync(filePath)) {
    return { rows: [], total: 0, filtered_total: 0 };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = splitCsvRecords(content);

  // Skip header
  const dataRecords = records.slice(1);
  const total = dataRecords.length;

  let rows: BatchResultRow[] = [];
  for (const record of dataRecords) {
    const fields = parseCsvLine(record);
    const row = lineToRow(fields);
    if (row) rows.push(row);
  }

  // Apply filters
  if (query.model) {
    rows = rows.filter((r) => r.model_name === query.model);
  }
  if (query.search_enabled !== undefined) {
    rows = rows.filter((r) => r.search_enabled === query.search_enabled);
  }
  if (query.question_id) {
    rows = rows.filter((r) => r.question_id === query.question_id);
  }
  if (query.date_from) {
    const from = new Date(query.date_from).getTime();
    rows = rows.filter((r) => new Date(r.timestamp).getTime() >= from);
  }
  if (query.date_to) {
    const to = new Date(query.date_to).getTime();
    rows = rows.filter((r) => new Date(r.timestamp).getTime() <= to);
  }

  const filtered_total = rows.length;

  // Sort by timestamp descending
  rows.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Pagination
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  rows = rows.slice(offset, offset + limit);

  return { rows, total, filtered_total };
}

export function getCsvRowCount(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = splitCsvRecords(content);
  return Math.max(0, records.length - 1); // Subtract header
}

export function parseQuestionsCsv(content: string): BatchQuestion[] {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least 1 data row');
  }

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const textIdx = header.indexOf('text');
  if (textIdx === -1) {
    throw new Error('CSV must have a "text" column');
  }
  const idIdx = header.indexOf('id');

  const questions: BatchQuestion[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const text = fields[textIdx]?.trim();
    if (!text) continue;

    const id = idIdx !== -1 && fields[idIdx]?.trim()
      ? fields[idIdx].trim()
      : `q${String(questions.length + 1).padStart(2, '0')}`;
    questions.push({ id, text });
  }

  if (questions.length === 0) {
    throw new Error('CSV contains no valid questions');
  }
  if (questions.length > 100) {
    throw new Error('CSV exceeds maximum of 100 questions');
  }

  return questions;
}

export function saveCustomQuestions(filePath: string, questions: BatchQuestion[]): void {
  ensureDataDir(filePath);
  const header = 'id,text';
  const lines = questions.map((q) => `${escapeField(q.id)},${escapeField(q.text)}`);
  fs.writeFileSync(filePath, [header, ...lines].join('\n') + '\n', 'utf-8');
}

export function loadCustomQuestions(filePath: string): BatchQuestion[] | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  try {
    return parseQuestionsCsv(content);
  } catch {
    return null;
  }
}
