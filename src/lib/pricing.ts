export type PricedDocumentType = 'docx' | 'pdf';

export const DOCUMENT_TYPE_PRICING: Record<PricedDocumentType, { label: string; ratePerStudent: number }> = {
  docx: {
    label: 'DOCX',
    ratePerStudent: 3.5,
  },
  pdf: {
    label: 'PDF',
    ratePerStudent: 2,
  },
};

export function isPricedDocumentType(value: unknown): value is PricedDocumentType {
  return value === 'docx' || value === 'pdf';
}

export function calculateGenerationPricing(studentCount: number, documentType: PricedDocumentType) {
  const ratePerStudent = DOCUMENT_TYPE_PRICING[documentType].ratePerStudent;
  const rawTotal = studentCount * ratePerStudent;

  let discountPercent = 0;
  if (rawTotal >= 100) {
    discountPercent = 10;
  } else if (rawTotal >= 50) {
    discountPercent = 5;
  }

  const discountAmount = rawTotal * (discountPercent / 100);
  const subtotalAfterDiscount = rawTotal - discountAmount;
  const isUnderMinimum = subtotalAfterDiscount < 20;
  const finalAmount = isUnderMinimum ? 20 : subtotalAfterDiscount;
  const amountInCentavos = Math.round(finalAmount * 100);

  return {
    documentType,
    ratePerStudent,
    rawTotal,
    discountPercent,
    discountAmount,
    subtotalAfterDiscount,
    isUnderMinimum,
    finalAmount,
    amountInCentavos,
  };
}
