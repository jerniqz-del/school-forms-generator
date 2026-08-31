export type AgeInYearsAndMonths = {
  years: number | '';
  months: number | '';
};

const EMPTY_AGE: AgeInYearsAndMonths = { years: '', months: '' };

export function getDefaultSchoolYearStartDate(schoolYear: string): string {
  const match = schoolYear.match(/^(20\d{2})\s*[-\u2013\u2014/]\s*(?:20\d{2}|\d{2})$/);
  if (!match) return '';

  const suggestedDates: Record<string, string> = {
    '2026': '2026-06-08',
  };

  return suggestedDates[match[1]] || `${match[1]}-06-01`;
}

function parseDateParts(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = new Date(1899, 11, 30);
    excelEpoch.setDate(excelEpoch.getDate() + Math.floor(value));
    return excelEpoch;
  }

  const input = String(value ?? '').trim();
  if (!input) return null;

  const isoMatch = input.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return createValidDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const numericMatch = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (numericMatch) {
    let first = Number(numericMatch[1]);
    let second = Number(numericMatch[2]);
    let year = Number(numericMatch[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;

    // SF1 exports normally use month/day/year. If the first component cannot
    // be a month, treat the value as day/month/year.
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return createValidDate(year, month, day);
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function createValidDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function addCalendarMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return target;
}

export function calculateAgeInYearsAndMonths(
  birthdate: unknown,
  referenceDate: unknown
): AgeInYearsAndMonths {
  const birth = parseDateParts(birthdate);
  const reference = parseDateParts(referenceDate);
  if (!birth || !reference || reference < birth) return EMPTY_AGE;

  let totalMonths =
    (reference.getFullYear() - birth.getFullYear()) * 12 +
    reference.getMonth() -
    birth.getMonth();

  if (reference.getDate() < birth.getDate()) totalMonths -= 1;
  if (totalMonths < 0) return EMPTY_AGE;

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
  };
}

export function buildKindergartenTemplateFields(
  lrn: string,
  birthdate: unknown,
  schoolYearStartDate: string
): Record<string, string | number> {
  const digits = String(lrn ?? '').replace(/\D/g, '').slice(0, 12).split('');
  const start = parseDateParts(schoolYearStartDate);
  const end = start ? addCalendarMonths(start, 10) : null;
  const bosy = calculateAgeInYearsAndMonths(birthdate, start);
  const eosy = calculateAgeInYearsAndMonths(birthdate, end);

  const fields: Record<string, string | number> = {
    AgeAtBOSYYears: bosy.years,
    AgeAtBOSYMonths: bosy.months,
    AgeAtEOSYYears: eosy.years,
    AgeAtEOSYMonths: eosy.months,
    AgeAtBOSY: bosy.years === '' ? '' : `${bosy.years} years, ${bosy.months} months`,
    AgeAtEOSY: eosy.years === '' ? '' : `${eosy.years} years, ${eosy.months} months`,
  };

  for (let index = 0; index < 12; index += 1) {
    fields[`LRN${index + 1}`] = digits[index] || '';
  }

  return fields;
}
