import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://kdrama-one.vercel.app/schedule', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { 
        revalidate: 3600 // Cache for 1 hour
      }
    });

    if (!response.ok) {
      console.error(`External API error: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Validate the response structure
    if (!data || !data.result || !data.result.days) {
      console.error('Invalid response structure from external API:', data);
      throw new Error('Invalid response structure');
    }
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    
    // Return fallback data structure to prevent complete failure
    const fallbackData = {
      error: null,
      page: "schedule",
      result: {
        days: {
          monday: { count: 0, day: "Monday", dramas: [] },
          tuesday: { count: 0, day: "Tuesday", dramas: [] },
          wednesday: { count: 0, day: "Wednesday", dramas: [] },
          thursday: { count: 0, day: "Thursday", dramas: [] },
          friday: { count: 0, day: "Friday", dramas: [] },
          saturday: { count: 0, day: "Saturday", dramas: [] },
          sunday: { count: 0, day: "Sunday", dramas: [] },
        },
        schedule_note: "Schedule data temporarily unavailable"
      },
      status: 200
    };
    
    return NextResponse.json(fallbackData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' // Shorter cache for fallback
      }
    });
  }
}