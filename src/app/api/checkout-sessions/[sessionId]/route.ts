import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-02-15' })
  : null;

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const session = await stripe.checkout.sessions.retrieve(params.sessionId, {
      expand: ['payment_intent', 'customer']
    });

    return NextResponse.json({
      status: session.status,
      amount_total: session.amount_total,
      customer_email: session.customer_details?.email,
      metadata: session.metadata
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session details' },
      { status: 500 }
    );
  }
} 