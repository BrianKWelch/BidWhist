import { BadgeVisitorDraft } from '@/types/badgeVisitor';

export interface OcrLine {
  text: string;
  /** 0-100 Tesseract confidence, or -1 if unknown (always kept). */
  confidence: number;
}

const BADGE_TYPE_KEYWORDS = [
  'exhibitor', 'attendee', 'speaker', 'staff', 'sponsor', 'guest',
  'press', 'media', 'vip', 'presenter', 'vendor', 'volunteer', 'organizer',
];

const EVENT_KEYWORDS = [
  'summit', 'conference', 'expo', 'convention', 'symposium', 'forum',
  'workshop', 'meeting', 'congress', 'legislative',
];

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine',
  'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
  'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

// Tesseract regularly glues a stray punctuation-like symbol onto the front
// or back of an otherwise-correct line (e.g. "| 2026 Chicago", ": Brian").
const MIN_LINE_CONFIDENCE = 45;

const NOISE_CHARS = "|:;'\"‘’“”=~`^*_.,·•-";

function stripNoise(text: string): string {
  const leading = new RegExp(`^[${NOISE_CHARS}\\s]+`);
  const trailing = new RegExp(`[${NOISE_CHARS}\\s]+$`);
  return text.replace(leading, '').replace(trailing, '').trim();
}

function cleanLines(lines: OcrLine[]): OcrLine[] {
  return lines
    .map((l) => ({ text: stripNoise(l.text.replace(/\s+/g, ' ')), confidence: l.confidence }))
    .filter((l) => l.text.length > 1 && /[a-zA-Z]/.test(l.text))
    // confidence -1 means "unknown" (plain-text fallback, no per-line score available)
    .filter((l) => l.confidence < 0 || l.confidence >= MIN_LINE_CONFIDENCE);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function takeMatch(lines: OcrLine[], predicate: (text: string) => boolean): string | undefined {
  const idx = lines.findIndex((l) => predicate(l.text));
  if (idx === -1) return undefined;
  const [line] = lines.splice(idx, 1);
  return line.text;
}

function isEventLine(text: string): boolean {
  return EVENT_KEYWORDS.some((k) => new RegExp(k, 'i').test(text)) || /\b(19|20)\d{2}\b/.test(text);
}

// A short, mostly-letters fragment right before the matched event lines is
// usually the organization's acronym/logo line (e.g. "NCSL" above "2026
// Chicago Legislative Summit"), not part of Name/Company.
function looksLikeHeaderFragment(text: string): boolean {
  return text.split(' ').length <= 2 && text.replace(/[^a-zA-Z]/g, '').length <= 8;
}

// Event names are often split across several consecutive badge lines (e.g.
// "NCSL" / "2026 Chicago" / "Legislative Summit") -- grab the whole run
// instead of just the first line that happens to match.
function takeEventRun(lines: OcrLine[]): string | undefined {
  const matchIdxs = lines.reduce<number[]>((acc, l, idx) => {
    if (isEventLine(l.text)) acc.push(idx);
    return acc;
  }, []);
  if (!matchIdxs.length) return undefined;

  let start = matchIdxs[0];
  let end = matchIdxs[0];
  for (const idx of matchIdxs.slice(1)) {
    if (idx - end <= 1) end = idx;
    else break;
  }
  if (start > 0 && looksLikeHeaderFragment(lines[start - 1].text)) {
    start -= 1;
  }

  const run = lines.slice(start, end + 1).map((l) => l.text);
  lines.splice(start, end - start + 1);
  return run.join(' ');
}

/**
 * Best-effort guess at Name/Company/Location/etc. from OCR'd badge lines.
 * Badge layouts vary a lot, so this only pre-fills the review form -- the
 * caller is expected to let the user confirm/edit every field.
 */
export function parseBadgeLines(ocrLines: OcrLine[]): Partial<BadgeVisitorDraft> {
  const remaining = cleanLines(ocrLines);
  const result: Partial<BadgeVisitorDraft> = {};

  const badgeType = takeMatch(
    remaining,
    (t) => t.split(' ').length <= 3 && BADGE_TYPE_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(t))
  );
  if (badgeType) result.badge_type = titleCase(badgeType);

  const event = takeEventRun(remaining);
  if (event) result.event_name = event;

  const location = takeMatch(
    remaining,
    (t) =>
      US_STATES.some((s) => t.toLowerCase() === s.toLowerCase()) ||
      (/,\s*[A-Z]{2}\b/.test(t) && t.split(' ').length <= 5) ||
      /^[A-Z]{2}$/.test(t)
  );
  if (location) result.location = location;

  // Prefer a "First Last" (2-word) line for the name; fall back to the
  // closest word count, then to whatever's left.
  const nameCandidates = remaining
    .map((l, idx) => ({ line: l.text, idx, words: l.text.split(' ').length }))
    .filter((c) => c.words <= 4 && !/\d/.test(c.line));
  if (nameCandidates.length) {
    nameCandidates.sort((a, b) => Math.abs(a.words - 2) - Math.abs(b.words - 2) || a.idx - b.idx);
    const best = nameCandidates[0];
    result.name = best.line;

    // Badges often repeat a bare first name right next to the full name
    // (e.g. "Brian" above "Brian Welch") -- drop that duplicate too
    // instead of letting it leak into Company/Title.
    const dupIdx = [best.idx - 1, best.idx + 1].find((i) => {
      const candidate = remaining[i]?.text;
      if (!candidate) return false;
      const a = candidate.toLowerCase();
      const b = best.line.toLowerCase();
      return a !== b && (b.startsWith(a) || a.startsWith(b));
    });

    for (const i of [best.idx, dupIdx].filter((i): i is number => i !== undefined).sort((a, b) => b - a)) {
      remaining.splice(i, 1);
    }
  }

  if (remaining.length) result.company = remaining[0].text;
  if (remaining.length > 1) result.title = remaining[1].text;

  return result;
}

interface TesseractLine {
  text: string;
  confidence: number;
}
interface TesseractParagraph {
  lines?: TesseractLine[] | null;
}
interface TesseractBlock {
  paragraphs?: TesseractParagraph[] | null;
}

/**
 * Tesseract's per-line confidence (only present when `recognize` is called
 * with `{ blocks: true }`) is far more reliable for filtering out garbage
 * than trying to pattern-match noise out of plain text. Falls back to
 * splitting the plain text (treating every line as equally trustworthy)
 * when block data isn't available.
 */
export function extractOcrLines(blocks: TesseractBlock[] | null | undefined, fallbackText: string): OcrLine[] {
  const lines: OcrLine[] = [];
  for (const block of blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        lines.push({ text: line.text, confidence: line.confidence });
      }
    }
  }
  if (lines.length) return lines;
  return fallbackText.split('\n').map((text) => ({ text, confidence: -1 }));
}

/** Back-compat convenience wrapper for callers that only have plain text. */
export function parseBadgeText(rawText: string): Partial<BadgeVisitorDraft> {
  return parseBadgeLines(rawText.split('\n').map((text) => ({ text, confidence: -1 })));
}
