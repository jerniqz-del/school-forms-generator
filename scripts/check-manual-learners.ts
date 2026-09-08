import assert from 'node:assert/strict';
import {
  createManualClassFileName,
  isDuplicateLrn,
  isManualClassId,
  nextManualLearnerLrn,
  prepareManualLearner,
  validateManualClass,
} from '../src/lib/manual-learners';

assert.equal(isManualClassId('manual-class-123'), true);
assert.equal(isManualClassId('SF1.xlsx'), false);
assert.equal(createManualClassFileName('SPED', 'HOPE'), 'Manual SPED - HOPE');
assert.equal(nextManualLearnerLrn(['MANUAL-001', '123']), 'MANUAL-002');
assert.equal(isDuplicateLrn(' 123 ', ['123']), true);
assert.equal(isDuplicateLrn('123', ['456']), false);

const missingName = prepareManualLearner(
  {
    LRN: '',
    Name: '  ',
    Sex: '',
    Birthdate: '',
    Age: '',
    Barangay: '',
    Municipality: '',
    Province: '',
    FatherName: '',
    MotherName: '',
  },
  []
);
assert.equal(missingName.error, 'Learner name is required.');

const duplicate = prepareManualLearner(
  {
    LRN: '123456789012',
    Name: 'DELA CRUZ, JUAN D.',
    Sex: 'Male',
    Birthdate: '01/01/2015',
    Age: 11,
    Barangay: '',
    Municipality: '',
    Province: '',
    FatherName: '',
    MotherName: '',
  },
  ['123456789012']
);
assert.match(String(duplicate.error), /already in this class/);

const added = prepareManualLearner(
  {
    LRN: '',
    Name: '  SANTOS, ANA  ',
    Sex: 'Female',
    Birthdate: '02/02/2016',
    Age: '',
    Barangay: 'Poblacion',
    Municipality: '',
    Province: '',
    FatherName: '',
    MotherName: '',
  },
  ['MANUAL-001']
);
assert.equal(added.learner?.Name, 'SANTOS, ANA');
assert.equal(added.learner?.LRN, 'MANUAL-002');
assert.equal(added.learner?.Sex, 'Female');

assert.equal(validateManualClass({ gradeLevel: '', section: 'HOPE', adviser: '' }), 'Select a grade level.');
assert.equal(validateManualClass({ gradeLevel: 'SPED', section: '  ', adviser: '' }), 'Section is required.');
assert.equal(validateManualClass({ gradeLevel: 'SPED', section: 'HOPE', adviser: '' }), null);

console.log('manual learner checks passed');
