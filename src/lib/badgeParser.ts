import { BadgeVisitorDraft } from '@/types/badgeVisitor';

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

function cleanLines(rawText: string): string[] {
  return rawText
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 1 && /[a-zA-Z]/.test(l));
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Best-effort guess at Name/Company/Location/etc. from raw OCR text.
 * Badge layouts vary a lot, so this only pre-fills the review form --
 * the caller is expected to let the user confirm/edit every field.
 */
export function parseBadgeText(rawText: string): Partial<BadgeVisitorDraft> {
  const remaining = cleanLines(rawText);
  const result: Partial<BadgeVisitorDraft> = {};

  const takeMatch = (predicate: (line: string) => boolean): string | undefined => {
    const idx = remaining.findIndex(predicate);
    if (idx === -1) return undefined;
    const [line] = remaining.splice(idx, 1);
    return line;
  };

  const badgeType = takeMatch(
    (l) => l.split(' ').length <= 3 && BADGE_TYPE_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`, 'i').test(l))
  );
  if (badgeType) result.badge_type = titleCase(badgeType);

  const event = takeMatch(
    (l) => EVENT_KEYWORDS.some((k) => new RegExp(k, 'i').test(l)) || /\b(19|20)\d{2}\b/.test(l)
  );
  if (event) result.event_name = event;

  const location = takeMatch(
    (l) =>
      US_STATES.some((s) => l.toLowerCase() === s.toLowerCase()) ||
      (/,\s*[A-Z]{2}\b/.test(l) && l.split(' ').length <= 5) ||
      (/^[A-Z]{2}$/.test(l))
  );
  if (location) result.location = location;

  // Prefer a "First Last" (2-word) line for the name; fall back to the
  // closest word count, then to whatever's left.
  const nameCandidates = remaining
    .map((line, idx) => ({ line, idx, words: line.split(' ').length }))
    .filter((c) => c.words <= 4 && !/\d/.test(c.line));
  if (nameCandidates.length) {
    nameCandidates.sort((a, b) => Math.abs(a.words - 2) - Math.abs(b.words - 2) || a.idx - b.idx);
    const best = nameCandidates[0];
    result.name = best.line;
    remaining.splice(remaining.indexOf(best.line), 1);
  }

  if (remaining.length) {
    result.company = remaining[0];
  }
  if (remaining.length > 1) {
    result.title = remaining[1];
  }

  return result;
}
