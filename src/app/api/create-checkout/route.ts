import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      { error: 'Direct generation payments are disabled. Please reload tokens instead.' },
      { status: 410 }
    );
  } catch (error: any) {
    console.error('Disabled checkout route error:', error);
    return NextResponse.json({ error: error.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
