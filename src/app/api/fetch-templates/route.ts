
import { NextRequest, NextResponse } from 'next/server';

const GITHUB_API_URL = 'https://api.github.com';
const REPO_OWNER = 'jerniqz-del'; 

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get('repo');

  if (!repo) {
    return NextResponse.json({ error: 'Missing repository parameter.' }, { status: 400 });
  }

  const url = `${GITHUB_API_URL}/repos/${REPO_OWNER}/${repo}/contents/`;
  
  try {
    // Note: No token is used here, so it relies on public access and default rate limits.
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
        }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      console.error(`GitHub API error for repo ${repo}:`, errorData);
      return NextResponse.json(
        { error: `Failed to fetch from GitHub: ${errorData.message || response.statusText}` }, 
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`Error fetching from GitHub API for repo ${repo}:`, error);
    return NextResponse.json(
      { error: 'An internal server error occurred while fetching templates.' }, 
      { status: 500 }
    );
  }
}
