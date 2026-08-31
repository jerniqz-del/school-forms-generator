# DOCX Template Placeholders

Templates are rendered with Docxtemplater. Learner fields must be placed inside the `students` loop when a document is generated for more than one learner.

```text
{#students}
...learner placeholders...
{/students}
```

## Shared and section fields

- `{school}`
- `{schoolHead}`
- `{schoolHeadDesignation}`
- `{region}`
- `{division}`
- `{district}`
- `{municipality}`
- `{schoolYear}`
- `{schoolYearStartDate}`
- `{gradeLevel}`
- `{section}`
- `{adviser}`
- `{%logo}`

## Learner fields

- `{LRN}`
- `{Name}`
- `{Sex}`
- `{Birthdate}`
- `{Age}`
- `{Barangay}`
- `{Municipality}`
- `{Province}`
- `{FatherName}`
- `{MotherName}`

## Kindergarten age fields

The beginning-of-school-year values use `{schoolYearStartDate}`. The end-of-school-year values use the date exactly 10 calendar months later.
For school year 2026-2027, the app suggests June 8, 2026; the user can change this date before generation.

- `{AgeAtBOSYYears}`
- `{AgeAtBOSYMonths}`
- `{AgeAtEOSYYears}`
- `{AgeAtEOSYMonths}`
- `{AgeAtBOSY}` — combined text, such as `4 years, 6 months`
- `{AgeAtEOSY}` — combined text, such as `5 years, 4 months`

## LRN digit boxes

Use one placeholder in each Word table cell:

```text
{LRN1} {LRN2} {LRN3} {LRN4} {LRN5} {LRN6}
{LRN7} {LRN8} {LRN9} {LRN10} {LRN11} {LRN12}
```

Only numeric characters are used. Missing digits render as blank cells.

## Kinder SF1 parent-name sources

Parent names are read from the same learner row beginning at Excel row 7:

- Column `AB`: father name
- Column `AF`: mother name

Names are normalized to `LAST NAME, FIRST NAME, MIDDLE NAME`. When **Use Middle Initial in Names** is enabled, parent names also use a middle initial in the generated document.

## Kindergarten export package

Kindergarten automatically uses `Latest KPRC and PECD Cover Page.docx`. Every Kindergarten download is a ZIP containing:

- The populated cover-page DOCX
- `Latest KPRC and PECD Content Pages 3-10.pdf`

For multiple sections, each generated Kindergarten DOCX receives a correspondingly prefixed copy of the companion PDF in the ZIP.
