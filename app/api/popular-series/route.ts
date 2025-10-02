import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://kdrama-one.vercel.app/top-dramas', {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HanStream/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
      },
    });
  } catch (error) {
    console.error('Error fetching popular series:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular series' },
      { status: 500 }
    );
  }
}