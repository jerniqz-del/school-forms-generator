export const SPECIAL_CLASS_GRADES = ['Four', 'Five', 'Six'] as const;
export type SpecialClassGrade = (typeof SPECIAL_CLASS_GRADES)[number];

export const SPECIAL_SUBJECT_OPTIONS = [
  'Journalism',
  'Research',
  'Math Oriented',
  'Science Oriented',
] as const;
export type SpecialSubject = (typeof SPECIAL_SUBJECT_OPTIONS)[number];

export const SPECIAL_TEMPLATE_FILE_NAMES = SPECIAL_CLASS_GRADES.map(
  (gradeLevel) => `Grade ${gradeLevel} - Special.docx`
);

type SpecialClassFileInfo = {
  gradeLevel: string;
  isSpecialClass?: boolean;
  specialSubject?: string;
};

export function isSpecialClassGrade(gradeLevel: string): gradeLevel is SpecialClassGrade {
  return (SPECIAL_CLASS_GRADES as readonly string[]).includes(gradeLevel);
}

export function isSpecialClassEnabled(fileInfo: SpecialClassFileInfo): boolean {
  return Boolean(fileInfo.isSpecialClass && isSpecialClassGrade(fileInfo.gradeLevel));
}

export function getTemplateGradeKey(fileInfo: SpecialClassFileInfo): string {
  if (isSpecialClassEnabled(fileInfo)) {
    return `${fileInfo.gradeLevel} - Special`;
  }
  return fileInfo.gradeLevel;
}

export function getSpecialTemplateFileName(gradeLevel: string): string {
  return `Grade ${gradeLevel} - Special.docx`;
}

export function getSpecialSubjectValue(fileInfo: SpecialClassFileInfo): string {
  return isSpecialClassEnabled(fileInfo) ? fileInfo.specialSubject || '' : '';
}

export function isSpecialClassSelectionIncomplete(fileInfo: SpecialClassFileInfo): boolean {
  return isSpecialClassEnabled(fileInfo) && !fileInfo.specialSubject;
}
