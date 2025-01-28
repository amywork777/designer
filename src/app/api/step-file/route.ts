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

    const { designId, designName, customerEmail, metadata } = await req.json();
    
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
        orderType: 'STEP_FILE'
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

    // Send order confirmation email
    const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-order-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderType: 'STEP_FILE',
        orderDetails: {
          metadata: {
            designId,
            fileType: 'step',
            orderType: 'STEP_FILE'
          },
          amount_total: 2000,
          email: session.user.email,
          userEmail: session.user.email
        },
        sessionId: checkoutSession.id
      })
    });

    if (!emailResponse.ok) {
      console.error('Failed to send order confirmation email');
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    );
  }
} 