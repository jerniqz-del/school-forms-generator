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

const STUDENT_LOOP_OPEN_XML = '<w:p><w:r><w:t>{#students}</w:t></w:r></w:p>';
const STUDENT_LOOP_CLOSE_XML = '<w:p><w:r><w:t>{/students}</w:t></w:r></w:p>';

export function repairSpedCoverDocumentXml(documentXml: string): string {
  if (!documentXml || !/<w:body[^>]*>/.test(documentXml)) {
    return documentXml;
  }

  let xml = documentXml
    .replace(/\{#students?\}/g, '')
    .replace(/\{\/students?\}/g, '')
    .replace(/\{#(?:<[^>]+>)*students?\}/g, '')
    .replace(/\{\/(?:<[^>]+>)*students?\}/g, '');

  xml = xml.replace(/(<w:body[^>]*>)/, `$1${STUDENT_LOOP_OPEN_XML}`);

  const openIdx = xml.indexOf(STUDENT_LOOP_OPEN_XML);
  const sectIdx = xml.lastIndexOf('<w:sectPr');
  const bodyCloseIdx = xml.lastIndexOf('</w:body>');
  if (sectIdx !== -1 && sectIdx > openIdx && (bodyCloseIdx === -1 || sectIdx < bodyCloseIdx)) {
    return `${xml.slice(0, sectIdx)}${STUDENT_LOOP_CLOSE_XML}${xml.slice(sectIdx)}`;
  }
  if (bodyCloseIdx !== -1 && bodyCloseIdx > openIdx) {
    return `${xml.slice(0, bodyCloseIdx)}${STUDENT_LOOP_CLOSE_XML}${xml.slice(bodyCloseIdx)}`;
  }
  return xml;
}

export function formatGradeTemplateLabel(gradeLevel: string): string {
  if (gradeLevel === 'Kinder') return 'Kindergarten Template';
  if (isSpedGrade(gradeLevel)) return 'SPED Template';
  return `Grade ${gradeLevel} Template`;
}
