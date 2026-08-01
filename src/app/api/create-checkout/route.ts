import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ 
        error: 'Paymongo secret key is missing in environment variables.' 
      }, { status: 500 });
    }

    const { studentCount } = await request.json();
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    if (!studentCount || typeof studentCount !== 'number' || studentCount <= 0) {
      return NextResponse.json({ error: 'Invalid student count.' }, { status: 400 });
    }

    // Pricing calculation
    // Base rate: PHP 2.50 per student
    const rawTotal = studentCount * 2.50;

    // Automatic Tiered/Volume Promo Discounts:
    // > 100 to 250 -> 5% discount
    // > 250 -> 10% discount
    let discountPercent = 0;
    if (rawTotal > 250) {
      discountPercent = 10;
    } else if (rawTotal > 100) {
      discountPercent = 5;
    }

    const discountAmount = rawTotal * (discountPercent / 100);
    const subtotalAfterDiscount = rawTotal - discountAmount;

    // Convert to centavos (1 PHP = 100 centavos)
    const subtotalInCentavos = Math.round(subtotalAfterDiscount * 100);

    // Paymongo checkout session minimum is PHP 20.00 (2000 centavos).
    // If calculated total is less than PHP 20.00, we apply the PHP 20.00 minimum transaction fee.
    const amountInCentavos = Math.max(2000, subtotalInCentavos);
    const hasAppliedMinimum = amountInCentavos === 2000 && subtotalInCentavos < 2000;

    const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

    const lineItemName = `SF9 Generation Fee (${studentCount} student${studentCount > 1 ? 's' : ''})`;
    let lineItemDescription = `Generation for ${studentCount} student(s) at ₱2.50/student.`;
    if (discountPercent > 0) {
      lineItemDescription += ` (${discountPercent}% bulk promo discount applied).`;
    }
    if (hasAppliedMinimum) {
      lineItemDescription += ' Paymongo PHP 20.00 minimum transaction fee applied.';
    }

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: true,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                amount: amountInCentavos,
                currency: 'PHP',
                name: lineItemName,
                quantity: 1,
                description: lineItemDescription,
              }
            ],
            payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay'],
            success_url: `${origin}/?payment_status=success`,
            cancel_url: `${origin}/?payment_status=cancelled`,
            description: `Payment for SF9 document generation of ${studentCount} student(s).`
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

    const checkoutUrl = resData?.data?.attributes?.checkout_url;
    if (!checkoutUrl) {
      throw new Error('Checkout URL not found in Paymongo response.');
    }

    return NextResponse.json({ url: checkoutUrl });

  } catch (error: any) {
    console.error('Paymongo API Route Error:', error);
    return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
