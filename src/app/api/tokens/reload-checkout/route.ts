import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, requireUserIdFromRequest } from '@/lib/firebase-admin';
import { TOKEN_RELOAD_MIN_PESOS, calculateTokenReload } from '@/lib/tokens';

function getPayMongoError(data: any) {
  const firstError = data?.errors?.[0];
  return firstError?.detail || firstError?.title || firstError?.code || 'Failed to create token reload checkout session.';
}

export async function POST(request: NextRequest) {
  try {
    const uid = await requireUserIdFromRequest(request);
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Paymongo secret key is missing in environment variables.' }, { status: 500 });
    }

    const { amountPesos } = await request.json();
    const amount = Number(amountPesos);
    if (!Number.isFinite(amount) || amount < TOKEN_RELOAD_MIN_PESOS) {
      return NextResponse.json({ error: `Minimum token reload is PHP ${TOKEN_RELOAD_MIN_PESOS}.` }, { status: 400 });
    }

    const reload = calculateTokenReload(amount);
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

    const response = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
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
                amount: reload.amountInCentavos,
                currency: 'PHP',
                name: `School Forms Generator Token Reload`,
                quantity: 1,
                description: `${reload.totalTokens} token(s)${reload.bonusTokens > 0 ? ` including ${reload.bonusTokens} bonus tokens` : ''}.`,
              },
            ],
            payment_method_types: ['qrph'],
            success_url: `${origin}/?token_payment_status=success`,
            cancel_url: `${origin}/?token_payment_status=cancelled`,
            reference_number: `SFG-TOKENS-${Date.now()}`,
            description: `Token reload for School Forms Generator.`,
          },
        },
      }),
    });

    const resData = await response.json();
    if (!response.ok) {
      const errorMsg = getPayMongoError(resData);
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const checkoutSessionId = resData?.data?.id;
    const checkoutUrl = resData?.data?.attributes?.checkout_url;
    if (!checkoutSessionId || !checkoutUrl) {
      throw new Error('Checkout session was incomplete.');
    }

    await getAdminFirestore().collection('tokenReloads').doc(checkoutSessionId).set({
      uid,
      checkoutSessionId,
      amountPesos: reload.amountPesos,
      amountInCentavos: reload.amountInCentavos,
      baseTokens: reload.baseTokens,
      bonusTokens: reload.bonusTokens,
      totalTokens: reload.totalTokens,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ url: checkoutUrl, checkoutSessionId, reload });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to create token reload checkout.' }, { status: 500 });
  }
}
