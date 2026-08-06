import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, requireDecodedTokenFromRequest } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Admin API disabled — return gone
  return NextResponse.json({ error: 'Admin API disabled' }, { status: 410 });
}
