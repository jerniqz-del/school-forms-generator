export type ManualLearnerSex = 'Male' | 'Female' | '';

export type ManualLearnerDraft = {
  LRN: string;
  Name: string;
  Sex: ManualLearnerSex;
  Birthdate: string;
  Age: number | '';
  Barangay: string;
  Municipality: string;
  Province: string;
  FatherName: string;
  MotherName: string;
};

export type ManualClassInput = {
  gradeLevel: string;
  section: string;
  adviser: string;
};

export const EMPTY_MANUAL_LEARNER: ManualLearnerDraft = {
  LRN: '',
  Name: '',
  Sex: '',
  Birthdate: '',
  Age: '',
  Barangay: '',
  Municipality: '',
  Province: '',
  FatherName: '',
  MotherName: '',
};

export const MANUAL_GRADE_OPTIONS = [
  { value: 'Kinder', label: 'Kindergarten' },
  { value: 'SPED', label: 'SPED' },
  { value: 'One', label: 'Grade One' },
  { value: 'Two', label: 'Grade Two' },
  { value: 'Three', label: 'Grade Three' },
  { value: 'Four', label: 'Grade Four' },
  { value: 'Five', label: 'Grade Five' },
  { value: 'Six', label: 'Grade Six' },
  { value: 'Seven (Year I)', label: 'Grade Seven (Year I)' },
  { value: 'Eight (Year II)', label: 'Grade Eight (Year II)' },
  { value: 'Nine (Year III)', label: 'Grade Nine (Year III)' },
  { value: 'Ten (Year IV)', label: 'Grade Ten (Year IV)' },
  { value: 'Eleven', label: 'Grade Eleven' },
  { value: 'Twelve', label: 'Grade Twelve' },
] as const;

export const MANUAL_CLASS_ID_PREFIX = 'manual-class-';

export function isManualClassId(id: string) {
  return id.startsWith(MANUAL_CLASS_ID_PREFIX);
}

export function createManualClassId(existingIds: string[]) {
  const used = new Set(existingIds);
  let id = `${MANUAL_CLASS_ID_PREFIX}${Date.now()}`;
  if (!used.has(id)) return id;
  let n = 2;
  while (used.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

export function createManualClassFileName(gradeLevel: string, section: string) {
  const grade = (gradeLevel || 'Class').trim() || 'Class';
  const sec = (section || 'Section').trim() || 'Section';
  return `Manual ${grade} - ${sec}`;
}

export function nextManualLearnerLrn(existingLrns: string[]) {
  const used = new Set(existingLrns.map((value) => value.toLowerCase()));
  let n = 1;
  let lrn = '';
  do {
    lrn = `MANUAL-${String(n).padStart(3, '0')}`;
    n += 1;
  } while (used.has(lrn.toLowerCase()));
  return lrn;
}

export function normalizeEnteredLrn(lrn: string) {
  return String(lrn || '').replace(/\s+/g, '').trim();
}

export function isDuplicateLrn(lrn: string, existingLrns: string[]) {
  const key = normalizeEnteredLrn(lrn).toLowerCase();
  if (!key) return false;
  return existingLrns.some((existing) => existing.toLowerCase() === key);
}

export function parseLearnerAge(value: string | number | '') {
  if (value === '' || value == null) return '' as const;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return '' as const;
  return Math.floor(parsed);
}

export function prepareManualLearner(
  draft: ManualLearnerDraft,
  existingLrns: string[]
): { learner?: ManualLearnerDraft; error?: string } {
  const name = String(draft.Name || '').replace(/\s+/g, ' ').trim();
  if (!name) {
    return { error: 'Learner name is required.' };
  }

  const enteredLrn = normalizeEnteredLrn(draft.LRN);
  if (enteredLrn && isDuplicateLrn(enteredLrn, existingLrns)) {
    return { error: `LRN ${enteredLrn} is already in this class.` };
  }

  const sex = draft.Sex === 'Male' || draft.Sex === 'Female' ? draft.Sex : '';

  return {
    learner: {
      LRN: enteredLrn || nextManualLearnerLrn(existingLrns),
      Name: name,
      Sex: sex,
      Birthdate: String(draft.Birthdate || '').trim(),
      Age: parseLearnerAge(draft.Age),
      Barangay: String(draft.Barangay || '').trim(),
      Municipality: String(draft.Municipality || '').trim(),
      Province: String(draft.Province || '').trim(),
      FatherName: String(draft.FatherName || '').trim(),
      MotherName: String(draft.MotherName || '').trim(),
    },
  };
}

export function validateManualClass(input: ManualClassInput): string | null {
  if (!String(input.gradeLevel || '').trim()) {
    return 'Select a grade level.';
  }
  if (!String(input.section || '').trim()) {
    return 'Section is required.';
  }
  return null;
}
