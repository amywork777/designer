import { NextResponse } from 'next/server';
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not configured');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

// Ensure we have a valid URL by constructing it properly
function getAbsoluteUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
  // Remove trailing slashes from base and leading slashes from path
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${cleanBase}/${cleanPath}`;
}

export async function POST(req: Request) {
  console.log('🚀 Starting subscription creation...');
  try {
    const { priceId, userId, email } = await req.json();
    console.log('📦 Request data:', { priceId, userId, email });

    if (!userId) {
      console.error('❌ No userId provided');
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}?subscription_success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}`,
      customer_email: email,
      metadata: {
        userId: userId
      },
      subscription_data: {
        metadata: {
          userId: userId
        }
      }
    });

    console.log('✅ Session created with metadata:', session.metadata);
    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error('❌ Error creating subscription:', error);
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
  }
} 