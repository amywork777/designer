import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Your Mailchimp datacenter/server (e.g., 'us1', 'us2', etc.) - it's in your Mailchimp URL
    const dataCenter = process.env.MAILCHIMP_DC;
    // Your list/audience ID
    const listId = process.env.MAILCHIMP_LIST_ID;
    // Your API key
    const apiKey = process.env.MAILCHIMP_API_KEY;

    const data = {
      email_address: email,
      status: 'subscribed',
    };

    const response = await fetch(
      `https://${dataCenter}.api.mailchimp.com/3.0/lists/${listId}/members`,
      {
        method: 'POST',
        headers: {
          Authorization: `apikey ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      // If the email is already subscribed, Mailchimp returns a 400 status
      if (result.title === 'Member Exists') {
        return NextResponse.json(
          { error: 'Email already subscribed' },
          { status: 400 }
        );
      }
      throw new Error(result.detail || 'Failed to subscribe');
    }

    // Get the total member count
    const statsResponse = await fetch(
      `https://${dataCenter}.api.mailchimp.com/3.0/lists/${listId}`,
      {
        headers: {
          Authorization: `apikey ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const statsResult = await statsResponse.json();
    const subscriberCount = statsResult.stats?.member_count || 0;

    return NextResponse.json({
      message: 'Successfully subscribed',
      subscriberCount
    });
  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to process subscription' },
      { status: 500 }
    );
  }
} 