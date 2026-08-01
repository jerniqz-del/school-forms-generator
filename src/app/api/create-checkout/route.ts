import { NextRequest, NextResponse } from 'next/server';
import { DOCUMENT_TYPE_PRICING, calculateGenerationPricing, isPricedDocumentType } from '@/lib/pricing';

export async function POST(request: NextRequest) {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({
        error: 'Paymongo secret key is missing in environment variables.'
      }, { status: 500 });
    }

    const { studentCount, documentType } = await request.json();
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    if (!studentCount || typeof studentCount !== 'number' || !Number.isFinite(studentCount) || studentCount <= 0) {
      return NextResponse.json({ error: 'Invalid student count.' }, { status: 400 });
    }

    if (!isPricedDocumentType(documentType)) {
      return NextResponse.json({ error: 'Invalid document type.' }, { status: 400 });
    }

    const pricing = calculateGenerationPricing(studentCount, documentType);
    const documentLabel = DOCUMENT_TYPE_PRICING[documentType].label;
    const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

    const lineItemName = `SF9 ${documentLabel} Generation Fee (${studentCount} student${studentCount > 1 ? 's' : ''})`;
    let lineItemDescription = `${documentLabel} generation for ${studentCount} student(s) at PHP ${pricing.ratePerStudent.toFixed(2)}/student.`;
    if (pricing.discountPercent > 0) {
      lineItemDescription += ` (${pricing.discountPercent}% bulk promo discount applied).`;
    }
    if (pricing.isUnderMinimum) {
      lineItemDescription += ' Paymongo PHP 20.00 minimum transaction fee applied.';
    }

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                amount: pricing.amountInCentavos,
                currency: 'PHP',
                name: lineItemName,
                quantity: 1,
                description: lineItemDescription,
              }
            ],
            payment_method_types: ['qrph', 'card', 'gcash', 'paymaya', 'grab_pay'],
            success_url: `${origin}/?payment_status=success`,
            cancel_url: `${origin}/?payment_status=cancelled`,
            description: `Payment for SF9 ${documentLabel} document generation of ${studentCount} student(s).`
          }
        }
      }),
    });

    const resData = await response.json();

    if (!response.ok) {
      console.error('Paymongo API Error Response:', resData);
      const errorMsg = resData?.errors?.[0]?.detail || 'Failed to create Paymongo checkout session.';
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const checkoutSessionId = resData?.data?.id;
    const checkoutUrl = resData?.data?.attributes?.checkout_url;
    if (!checkoutSessionId) {
      throw new Error('Checkout session ID not found in Paymongo response.');
    }
    if (!checkoutUrl) {
      throw new Error('Checkout URL not found in Paymongo response.');
    }

    return NextResponse.json({ url: checkoutUrl, checkoutSessionId });
  } catch (error: any) {
    console.error('Paymongo API Route Error:', error);
    return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
