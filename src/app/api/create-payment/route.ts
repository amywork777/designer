import { NextResponse } from 'next/server';
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16'
});

export async function POST(req: Request) {
  try {
    // Log the request body for debugging
    const body = await req.json();
    console.log('Payment request body:', body);

    const {
      designData,
      userEmail,
      userId,
      designId
    } = body;

    // Validate required fields
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      );
    }

    if (!designId) {
      return NextResponse.json(
        { error: 'Design ID is required' },
        { status: 400 }
      );
    }

    // Log Stripe configuration
    console.log('Creating Stripe session with:', {
      email: userEmail,
      designId,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL
    });

    // Create Stripe payment session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Design Manufacturing Analysis Fee',
              description: 'Professional manufacturing analysis and consultation'
            },
            unit_amount: 5000, // $50.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}&design_id=${designId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cancel`,
      metadata: {
        designId,
        userId: userId || 'anonymous',
        userEmail,
      },
      customer_email: userEmail,
    });

    console.log('Stripe session created:', session.id);

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id
    });

  } catch (error: any) {
    console.error('Payment creation failed:', {
      error: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack
    });

    // Return a more detailed error response
    return NextResponse.json(
      { 
        error: 'Failed to create payment session',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
} 