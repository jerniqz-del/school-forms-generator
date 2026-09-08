import assert from 'node:assert/strict';
import { repairSpedCoverDocumentXml } from '../src/lib/sped-class';

const fixture = `<?xml version="1.0"?><w:document><w:body>
<w:p><w:r><w:t>TEACHER'S REMARKS</w:t></w:r></w:p>
<w:p><w:r><w:t>{%logo}</w:t></w:r><w:r><w:t>{#student}</w:t></w:r></w:p>
<w:p><w:r><w:t>Republic of the Philippines</w:t></w:r></w:p>
<w:p><w:r><w:t>{Name}</w:t></w:r></w:p>
<w:p><w:r><w:t>{/student}</w:t></w:r></w:p>
<w:p><w:r><w:t>DAILY LIVING SKILLS DOMAIN</w:t></w:r></w:p>
<w:sectPr><w:pgSz/></w:sectPr>
</w:body></w:document>`;

const repaired = repairSpedCoverDocumentXml(fixture);

assert.match(repaired, /<w:body>\s*<w:p><w:r><w:t>\{\#students\}<\/w:t><\/w:r><\/w:p>/);
assert.equal(repaired.includes('{#student}'), false);
assert.equal(repaired.includes('{/student}'), false);
assert.equal(repaired.includes('{#students}'), true);
assert.equal(repaired.includes('{/students}'), true);

const openIdx = repaired.indexOf('{#students}');
const closeIdx = repaired.indexOf('{/students}');
const remarksIdx = repaired.indexOf("TEACHER'S REMARKS");
const logoIdx = repaired.indexOf('{%logo}');
const nameIdx = repaired.indexOf('{Name}');
const skillsIdx = repaired.indexOf('DAILY LIVING SKILLS DOMAIN');
const sectIdx = repaired.indexOf('<w:sectPr');

assert.ok(openIdx < remarksIdx);
assert.ok(remarksIdx < closeIdx);
assert.ok(logoIdx > openIdx && logoIdx < closeIdx);
assert.ok(nameIdx > openIdx && nameIdx < closeIdx);
assert.ok(skillsIdx > openIdx && skillsIdx < closeIdx);
assert.ok(closeIdx < sectIdx);

const alreadyPlural = repairSpedCoverDocumentXml(
  '<w:body><w:p><w:r><w:t>{#students}</w:t></w:r></w:p><w:p><w:r><w:t>{Name}</w:t></w:r></w:p><w:p><w:r><w:t>{/students}</w:t></w:r></w:p></w:body>'
);
assert.equal((alreadyPlural.match(/\{\#students\}/g) || []).length, 1);
assert.equal((alreadyPlural.match(/\{\/students\}/g) || []).length, 1);
assert.ok(alreadyPlural.indexOf('{#students}') < alreadyPlural.indexOf('{Name}'));
assert.ok(alreadyPlural.indexOf('{Name}') < alreadyPlural.indexOf('{/students}'));

const splitAcrossRuns = repairSpedCoverDocumentXml(`<?xml version="1.0"?><w:document><w:body>
<w:tbl><w:tr><w:tc><w:p>
<w:r><w:t>{#</w:t></w:r><w:r><w:t>students}</w:t></w:r><w:r><w:t>TEACHER'S REMARKS</w:t></w:r>
</w:p></w:tc></w:tr></w:tbl>
<w:p><w:r><w:t>{Name}</w:t></w:r></w:p>
<w:p><w:r><w:t>{/student</w:t></w:r><w:r><w:t>s</w:t></w:r><w:r><w:t>}</w:t></w:r></w:p>
<w:p><w:r><w:t>DAILY LIVING SKILLS DOMAIN</w:t></w:r></w:p>
<w:sectPr><w:pgSz/></w:sectPr>
</w:body></w:document>`);

assert.equal(splitAcrossRuns.includes('{#</w:t>'), false);
assert.equal(splitAcrossRuns.includes('{/student</w:t>'), false);
assert.equal((splitAcrossRuns.match(/\{\#students\}/g) || []).length, 1);
assert.equal((splitAcrossRuns.match(/\{\/students\}/g) || []).length, 1);
assert.ok(splitAcrossRuns.indexOf('{#students}') < splitAcrossRuns.indexOf("TEACHER'S REMARKS"));
assert.ok(splitAcrossRuns.indexOf("TEACHER'S REMARKS") < splitAcrossRuns.indexOf('{/students}'));
assert.ok(splitAcrossRuns.indexOf('DAILY LIVING SKILLS DOMAIN') < splitAcrossRuns.indexOf('{/students}'));

console.log('sped cover placeholder checks passed');
