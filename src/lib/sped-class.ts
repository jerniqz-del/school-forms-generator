export const SPED_COVER_TEMPLATE_NAME = 'SPED PRC - Cover.docx';
export const SPED_CONTENT_PDF_NAME = 'SPED PRC - Content.pdf';
export const SPED_CONTENT_PDF_URL =
  'https://raw.githubusercontent.com/jerniqz-del/schoolform9/main/SPED%20PRC%20-%20Content.pdf';

export const SPED_COVER_TEMPLATE_FALLBACKS = [
  'SPED PRC Cover.docx',
  'SPED PRC - Cover Page.docx',
  'SPED Cover.docx',
];

export function isSpedGrade(gradeLevel: string): boolean {
  return gradeLevel === 'SPED';
}

export function looksLikeSpedSf1(...parts: Array<string | undefined | null>): boolean {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  return /(?:^|[^a-z0-9])(?:sped|sned)(?:[^a-z0-9]|$)|special\s*education|special\s*needs|non[\s_-]*graded/.test(text);
}

export function isSpedCoverTemplate(templateUrlOrName: string): boolean {
  const value = decodeURIComponent(templateUrlOrName || '').toLowerCase();
  if (!value) return false;
  if (value.includes(SPED_COVER_TEMPLATE_NAME.toLowerCase())) return true;
  if (SPED_COVER_TEMPLATE_FALLBACKS.some((name) => value.includes(name.toLowerCase()))) return true;
  return value.includes('sped') && value.includes('cover') && value.includes('.docx');
}

export function shouldBundleSpedContentPdf(gradeLevel: string, templateUrlOrName: string): boolean {
  return isSpedGrade(gradeLevel) || isSpedCoverTemplate(templateUrlOrName);
}

export function formatGradeTemplateLabel(gradeLevel: string): string {
  if (gradeLevel === 'Kinder') return 'Kindergarten Template';
  if (isSpedGrade(gradeLevel)) return 'SPED Template';
  return `Grade ${gradeLevel} Template`;
}
