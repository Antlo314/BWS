import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization');
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing credentials. Please sign in with Google.' },
        { status: 401 }
      );
    }

    const response = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Google Meet space creation failed:', data);
      return NextResponse.json(
        {
          error: data.error?.message || 'Google Meet API returned an error.',
          details: data.error || null,
        },
        { status: response.status }
      );
    }

    // Google Meet API returns a space object with a `meetingUri` and a `name` (space name)
    // Return this securely to the client
    return NextResponse.json({
      name: data.name,
      meetingUri: data.meetingUri,
    });
  } catch (error: any) {
    console.error('Exception during Google Meet space creation proxy:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to establish Google Meet connection.' },
      { status: 500 }
    );
  }
}
