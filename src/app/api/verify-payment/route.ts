import { NextRequest, NextResponse } from 'next/server';
import { calculateGenerationPricing, isPricedDocumentType } from '@/lib/pricing';

const PAYMONGO_API_URL = 'https://api.paymongo.com/v1/checkout_sessions';

export async function POST(request: NextRequest) {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { verified: false, error: 'Paymongo secret key is missing in environment variables.' },
        { status: 500 }
      );
    }

    const { checkoutSessionId, studentCount, documentType } = await request.json();

    if (
      typeof checkoutSessionId !== 'string' ||
      !checkoutSessionId.startsWith('cs_') ||
      typeof studentCount !== 'number' ||
      !Number.isFinite(studentCount) ||
      studentCount <= 0 ||
      !isPricedDocumentType(documentType)
    ) {
      return NextResponse.json({ verified: false, error: 'Invalid payment verification request.' }, { status: 400 });
    }

    const response = await fetch(`${PAYMONGO_API_URL}/${encodeURIComponent(checkoutSessionId)}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      },
      cache: 'no-store',
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.errors?.[0]?.detail || 'Unable to verify payment with Paymongo.';
      return NextResponse.json({ verified: false, error: errorMsg }, { status: response.status });
    }

    const payments = data?.data?.attributes?.payments ?? [];
    const expectedAmount = calculateGenerationPricing(studentCount, documentType).amountInCentavos;
    const paidPayment = payments.find((payment: any) => {
      const attrs = payment?.attributes ?? payment;
      return attrs?.status === 'paid' && attrs?.currency === 'PHP' && attrs?.amount >= expectedAmount;
    });

    if (!paidPayment) {
      return NextResponse.json(
        { verified: false, error: 'Payment has not been confirmed yet.' },
        { status: 402 }
      );
    }

    return NextResponse.json({ verified: true });
  } catch (error: any) {
    console.error('Paymongo verification error:', error);
    return NextResponse.json(
      { verified: false, error: error.message || 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
