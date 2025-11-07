import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/top-dramas`, {
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