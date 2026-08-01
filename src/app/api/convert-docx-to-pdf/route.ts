import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const converterUrl = process.env.DOCX_CONVERTER_URL;
    const converterApiKey = process.env.DOCX_CONVERTER_API_KEY;

    if (!converterUrl || !converterApiKey) {
      return NextResponse.json(
        { error: 'DOCX converter service is not configured.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing DOCX file.' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      return NextResponse.json({ error: 'Only DOCX files can be converted.' }, { status: 400 });
    }

    const upstreamForm = new FormData();
    upstreamForm.append('file', file, file.name);

    const response = await fetch(`${converterUrl.replace(/\/$/, '')}/convert-to-pdf`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${converterApiKey}`,
      },
      body: upstreamForm,
      signal: AbortSignal.timeout(270_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('DOCX converter error:', errorText);
      let converterMessage = 'DOCX to PDF conversion failed.';
      try {
        const parsed = JSON.parse(errorText);
        if (typeof parsed?.detail === 'string') {
          converterMessage = parsed.detail;
        } else if (parsed?.detail?.message) {
          converterMessage = parsed.detail.message;
        }
      } catch {
        // Keep the generic message when the converter returns plain text or HTML.
      }
      return NextResponse.json(
        { error: converterMessage },
        { status: response.status }
      );
    }

    const pdfBuffer = await response.arrayBuffer();
    const outputName = file.name.replace(/\.docx$/i, '.pdf');

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${outputName}"`,
      },
    });
  } catch (error: any) {
    console.error('DOCX conversion route error:', error);
    return NextResponse.json(
      { error: error.message || 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}
