import { NextResponse } from 'next/server';

const BASE = 'https://kdrama-one.vercel.app';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const page = searchParams.get('page') || '1';

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const q = query.trim().toLowerCase().replace(/\s+/g, '-');
    const pageParam = parseInt(page) > 1 ? `&page=${page}` : '';
    
    const response = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}${pageParam}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { 
        revalidate: 900 // 15 minutes cache
      }
    });

    if (!response.ok) {
      console.error(`External search API error: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800'
      }
    });
  } catch (error) {
    console.error('Error fetching search results:', error);
    
    // Return fallback empty results
    return NextResponse.json(
      { 
        error: null,
        page: "search",
        query: "",
        results: [],
        status: 200
      },
      { status: 200 }
    );
  }
}