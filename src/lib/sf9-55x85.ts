const STUDENTS_OPEN_TAG_PATTERN = /\{#(?:<[^>]+>)*students\}/g;

const STUDENTS_OPEN_PARAGRAPH =
  '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="0" w:lineRule="exact"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:vanish/><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr><w:t>{#students}</w:t></w:r></w:p>';

function getParagraphText(paragraphXml: string): string {
  return paragraphXml
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function centerParagraphWithoutSpacing(paragraphXml: string): string {
  const openingTag = paragraphXml.match(/^<w:p(?:\s[^>]*)?>/);
  const normalizedProperties = '<w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/>';

  if (!openingTag) return paragraphXml;

  const contentAfterOpeningTag = paragraphXml.slice(openingTag[0].length);
  const directProperties = contentAfterOpeningTag.match(/^\s*(<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>)/);
  if (!directProperties) {
    return openingTag[0]
      + '<w:pPr>' + normalizedProperties + '</w:pPr>'
      + contentAfterOpeningTag;
  }

  const updatedProperties = directProperties[1]
    .replace(/<w:spacing\b[^>]*\/>/g, '')
    .replace(/<w:jc\b[^>]*\/>/g, '')
    .replace(/<w:ind\b[^>]*\/>/g, '')
    .replace('</w:pPr>', normalizedProperties + '</w:pPr>');

  return paragraphXml.replace(directProperties[1], updatedProperties);
}

function normalizeNationalHeaderParagraph(documentXml: string): string {
  const paragraphTagPattern = /<w:p(?:\s[^>]*)?>|<\/w:p>/g;
  const paragraphStarts: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = paragraphTagPattern.exec(documentXml))) {
    if (!match[0].startsWith('</')) {
      paragraphStarts.push(match.index);
      continue;
    }

    const paragraphStart = paragraphStarts.pop();
    if (paragraphStart === undefined) continue;

    const paragraphEnd = paragraphTagPattern.lastIndex;
    const paragraphXml = documentXml.slice(paragraphStart, paragraphEnd);
    const paragraphText = getParagraphText(paragraphXml).replace(/\s+/g, ' ').trim();
    if (!paragraphText.includes('Republic of the Philippines')) continue;

    return documentXml.slice(0, paragraphStart)
      + centerParagraphWithoutSpacing(paragraphXml)
      + documentXml.slice(paragraphEnd);
  }

  return documentXml;
}

export function repair55x85DocumentXml(documentXml: string): string {
  if (!documentXml || !/<w:body[^>]*>/.test(documentXml)) {
    return documentXml;
  }

  let repairedXml = documentXml
    .replace(STUDENTS_OPEN_TAG_PATTERN, '')
    .replace(/<w:lastRenderedPageBreak\s*\/>/g, '');

  repairedXml = repairedXml.replace(
    /(<w:body[^>]*>)/,
    (bodyStart) => bodyStart + STUDENTS_OPEN_PARAGRAPH
  );

  return normalizeNationalHeaderParagraph(repairedXml);
}


export function remove55x85LeadingSpacer(documentXml: string): string {
  const bodyMatch = /<w:body[^>]*>/.exec(documentXml);
  if (!bodyMatch) return documentXml;

  const paragraphTagPattern = /<w:p(?:\s[^>]*)?>|<\/w:p>/g;
  paragraphTagPattern.lastIndex = bodyMatch.index + bodyMatch[0].length;
  let depth = 0;
  let paragraphStart = -1;
  let match: RegExpExecArray | null;

  while ((match = paragraphTagPattern.exec(documentXml))) {
    if (!match[0].startsWith('</')) {
      if (depth === 0) paragraphStart = match.index;
      depth += 1;
      continue;
    }

    depth -= 1;
    if (depth !== 0 || paragraphStart < 0) continue;

    const paragraphEnd = paragraphTagPattern.lastIndex;
    const paragraphXml = documentXml.slice(paragraphStart, paragraphEnd);
    const isEmpty = getParagraphText(paragraphXml).trim() === '';
    const hasVisibleObject = /<w:(?:drawing|pict|object)\b/.test(paragraphXml);
    if (!isEmpty || hasVisibleObject) return documentXml;

    return documentXml.slice(0, paragraphStart) + documentXml.slice(paragraphEnd);
  }

  return documentXml;
}