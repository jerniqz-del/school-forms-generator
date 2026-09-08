import {
  isSpedCoverTemplate,
  isSpedGrade,
  SPED_COVER_TEMPLATE_FALLBACKS,
  SPED_COVER_TEMPLATE_NAME,
} from './sped-class';
import { SPECIAL_TEMPLATE_FILE_NAMES } from './special-class';

export const JHS_A5_TEMPLATE_NAMES = [
  'JHS - A5.docx',
  'JHS-A5.docx',
  'JHS A5.docx',
];

export function isA5TemplateFileName(fileName: string) {
  return /a5/i.test(fileName);
}

export function isJhsGradeLevel(gradeLevel: string) {
  return /^(Seven|Eight|Nine|Ten)\b/.test(gradeLevel);
}

export function isKinderTemplateFileName(fileName: string) {
  return /kinder|kprc|\bpecd\b/i.test(fileName);
}

export function isSpecialClassTemplateFileName(fileName: string) {
  return (
    SPECIAL_TEMPLATE_FILE_NAMES.some((name) => name.toLowerCase() === fileName.toLowerCase()) ||
    /^Grade (Four|Five|Six)\s*-\s*Special\.docx$/i.test(fileName)
  );
}

export function isSelectableA5Template(fileName: string) {
  if (!fileName.toLowerCase().endsWith('.docx')) return false;
  return (
    isA5TemplateFileName(fileName) ||
    isSpedCoverTemplate(fileName) ||
    isKinderTemplateFileName(fileName) ||
    isSpecialClassTemplateFileName(fileName)
  );
}

export function getPreferredTemplateNames(
  gradeLevel: string,
  selectedPaperSize: string,
  gradeToTemplateMap: Record<string, string | undefined> = {},
  gradeTemplateFallbacks: Record<string, string[] | undefined> = {}
) {
  const mappedNames = [
    gradeToTemplateMap[gradeLevel],
    ...(gradeTemplateFallbacks[gradeLevel] || []),
  ].filter((name): name is string => Boolean(name));

  if (selectedPaperSize === 'A5') {
    if (isSpedGrade(gradeLevel)) {
      return [SPED_COVER_TEMPLATE_NAME, ...SPED_COVER_TEMPLATE_FALLBACKS];
    }
    if (gradeLevel === 'Kinder' || /-\s*Special$/i.test(gradeLevel)) {
      return mappedNames;
    }
    if (isJhsGradeLevel(gradeLevel)) {
      return [...JHS_A5_TEMPLATE_NAMES];
    }
    return [`Grade ${gradeLevel} - A5.docx`, `Grade ${gradeLevel} A5.docx`];
  }

  return mappedNames;
}
