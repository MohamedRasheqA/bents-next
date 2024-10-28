import { NextResponse } from 'next/server';
import axios from 'axios';

const FLASK_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
        timeout: 30000 // 30 seconds timeout
      }
    );
    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error('Error in chat API route:', error.response?.data || error.message);
    return NextResponse.json(
      { 
        error: 'Failed to process chat request',
        details: error.response?.data?.error || error.message 
      },
      { status: 500 }
    );
  }
}
