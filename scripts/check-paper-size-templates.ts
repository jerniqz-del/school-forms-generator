import assert from 'node:assert/strict';
import {
  getPreferredTemplateNames,
  isSelectableA5Template,
  JHS_A5_TEMPLATE_NAMES,
} from '../src/lib/paper-size-templates';
import {
  shouldBundleSpedContentPdf,
  SPED_COVER_TEMPLATE_FALLBACKS,
  SPED_COVER_TEMPLATE_NAME,
} from '../src/lib/sped-class';

const gradeToTemplateMap: Record<string, string> = {
  Kinder: 'Latest KPRC and PECD Cover Page.docx',
  SPED: SPED_COVER_TEMPLATE_NAME,
  Four: 'Grade Four.docx',
  'Four - Special': 'Grade Four - Special.docx',
  'Seven (Year I)': 'Grade Seven.docx',
  Eleven: 'Grade Eleven.docx',
};

const gradeTemplateFallbacks: Record<string, string[]> = {
  SPED: SPED_COVER_TEMPLATE_FALLBACKS,
  'Four - Special': ['Grade Four Special.docx', 'Grade Four-Special.docx'],
  Kinder: ['Kinder Report Card.docx', 'Kinder PECD.docx'],
  Eleven: ['Grade 11.docx', 'Grade XI.docx', 'Grade Eleven (Year V).docx'],
};

assert.equal(isSelectableA5Template('JHS - A5.docx'), true);
assert.equal(isSelectableA5Template('SPED PRC - Cover.docx'), true);
assert.equal(isSelectableA5Template('Latest KPRC and PECD Cover Page.docx'), true);
assert.equal(isSelectableA5Template('Grade Four - Special.docx'), true);
assert.equal(isSelectableA5Template('Grade Eleven.docx'), true);
assert.equal(isSelectableA5Template('Grade 11.docx'), true);
assert.equal(isSelectableA5Template('Grade One.docx'), false);
assert.equal(isSelectableA5Template('Grade Seven.docx'), false);

assert.deepEqual(
  getPreferredTemplateNames('SPED', 'A5', gradeToTemplateMap, gradeTemplateFallbacks),
  [SPED_COVER_TEMPLATE_NAME, ...SPED_COVER_TEMPLATE_FALLBACKS]
);
assert.deepEqual(
  getPreferredTemplateNames('Kinder', 'A5', gradeToTemplateMap, gradeTemplateFallbacks),
  ['Latest KPRC and PECD Cover Page.docx', 'Kinder Report Card.docx', 'Kinder PECD.docx']
);
assert.deepEqual(
  getPreferredTemplateNames('Four - Special', 'A5', gradeToTemplateMap, gradeTemplateFallbacks),
  ['Grade Four - Special.docx', 'Grade Four Special.docx', 'Grade Four-Special.docx']
);
assert.deepEqual(
  getPreferredTemplateNames('Seven (Year I)', 'A5', gradeToTemplateMap, gradeTemplateFallbacks),
  JHS_A5_TEMPLATE_NAMES
);
assert.deepEqual(getPreferredTemplateNames('Four', 'A5', gradeToTemplateMap, gradeTemplateFallbacks), [
  'Grade Four - A5.docx',
  'Grade Four A5.docx',
]);
assert.deepEqual(
  getPreferredTemplateNames('Eleven', 'Custom', gradeToTemplateMap, gradeTemplateFallbacks),
  ['Grade Eleven.docx', 'Grade 11.docx', 'Grade XI.docx', 'Grade Eleven (Year V).docx']
);
assert.deepEqual(
  getPreferredTemplateNames('Eleven', 'A5', gradeToTemplateMap, gradeTemplateFallbacks),
  [
    'Grade Eleven - A5.docx',
    'Grade Eleven A5.docx',
    'Grade Eleven.docx',
    'Grade 11.docx',
    'Grade XI.docx',
    'Grade Eleven (Year V).docx',
  ]
);
assert.deepEqual(
  getPreferredTemplateNames('SPED', 'Custom', gradeToTemplateMap, gradeTemplateFallbacks),
  [SPED_COVER_TEMPLATE_NAME, ...SPED_COVER_TEMPLATE_FALLBACKS]
);

assert.equal(shouldBundleSpedContentPdf('SPED', 'JHS - A5.docx'), true);
assert.equal(shouldBundleSpedContentPdf('Four', 'SPED PRC - Cover.docx'), true);
assert.equal(shouldBundleSpedContentPdf('Four', 'JHS - A5.docx'), false);

console.log('paper size template checks passed');
