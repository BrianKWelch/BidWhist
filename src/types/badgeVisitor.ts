export interface BadgeVisitor {
  id: string;
  created_at: string;
  name: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  badge_type: string | null;
  event_name: string | null;
  notes: string | null;
  raw_ocr_text: string | null;
}

export type BadgeVisitorDraft = Omit<BadgeVisitor, 'id' | 'created_at'>;

export const EMPTY_BADGE_DRAFT: BadgeVisitorDraft = {
  name: '',
  title: '',
  company: '',
  location: '',
  badge_type: '',
  event_name: '',
  notes: '',
  raw_ocr_text: '',
};
