import { NextResponse } from 'next/server';
import axios from 'axios';
export const maxDuration = 300; // This function can run for a maximum of 5 seconds
const FLASK_URL = 'https://bents-llm-server.vercel.app';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    console.log('Sending request to Flask server:', `${FLASK_URL}/chat`);
    
    const response = await axios.post(
      `${FLASK_URL}/chat`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 300000, // 300 seconds (5 minutes) timeout
        validateStatus: (status) => status < 500 // Only reject if status >= 500
      }
    );

    if (response.data.error) {
      return NextResponse.json({ error: response.data.error }, { status: 400 });
    }

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error in chat API route:', error.response?.data || error.message);
    
    // Return a more detailed error response
    return NextResponse.json(
      { 
        error: 'Failed to process chat request',
        message: error.response?.data?.message || error.message,
        details: error.response?.data || 'No additional details available'
      },
      { status: error.response?.status || 500 }
    );
  }
}
