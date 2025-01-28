import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/auth';
import { STEP_FILE_PRICE } from '@/lib/constants/pricing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { designId, designName } = await req.json();
    
    if (!designId) {
      return NextResponse.json(
        { error: 'Design ID is required' },
        { status: 400 }
      );
    }

    // Log the incoming data
    console.log('Creating STEP file purchase:', {
      designId,
      designName,
      userId: session.user.id
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'STEP File Purchase',
            description: `STEP file for ${designName || 'Design'}`
          },
          unit_amount: 2000,
        },
        quantity: 1
      }],
      metadata: {
        type: 'step_file',
        designId: designId,
        userId: session.user.id,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/get-it-made`,
      customer_email: session.user.email
    });

    // Log the created session
    console.log('Checkout session created:', {
      sessionId: checkoutSession.id,
      metadata: checkoutSession.metadata
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    );
  }
} 