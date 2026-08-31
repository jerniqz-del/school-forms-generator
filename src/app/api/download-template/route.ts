
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const parsedUrl = new URL(url);
    const allowedHosts = ['raw.githubusercontent.com', 'github.com', 'objects.githubusercontent.com'];
    if (!allowedHosts.includes(parsedUrl.hostname)) {
      return new NextResponse('Forbidden: Only GitHub template URLs are permitted', { status: 403 });
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch file: ${response.statusText}`, { status: response.status });
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = parsedUrl.pathname.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error: any) {
    console.error('Error fetching file:', error);
    return new NextResponse('Error fetching file', { status: 500 });
  }
}
