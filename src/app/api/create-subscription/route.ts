import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

export async function POST(req: Request) {
  if (!stripe) {
    console.error('Stripe is not configured');
    return NextResponse.json(
      { error: 'Stripe is not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    console.log('Received request body:', body);

    const { priceId, userId } = body;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get the host from headers
    const headersList = headers();
    const host = headersList.get('host');
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    console.log('Creating Stripe session with:', { priceId, userId, baseUrl });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
      allow_promotion_codes: true,
    });

    console.log('Session created:', session.id);

    return NextResponse.json({ sessionId: session.id });
  } catch (err) {
    console.error('Stripe subscription error:', err);
    return NextResponse.json(
      { 
        error: err instanceof Error ? err.message : 'Error creating subscription',
        details: process.env.NODE_ENV === 'development' ? err : undefined
      },
      { status: 500 }
    );
  }
} 