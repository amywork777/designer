import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const { priceId, amount, quantity, metadata, customer_email } = await req.json();

    if (!stripe) {
      return NextResponse.json({
        error: 'Stripe is not configured'
      }, { status: 500 });
    }

    if (!priceId || !amount) {
      return NextResponse.json({
        error: 'Price ID and amount are required'
      }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: customer_email,
      line_items: [
        {
          price: priceId,
          quantity: quantity
        }
      ],
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US'],
      },
      shipping_options: [{
        shipping_rate: 'shr_1Qm46VCLoBz9jXRlIIuopjNw'
      }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/get-it-made`,
      metadata: {
        ...metadata,
        customer_email: customer_email
      }
    });

    return NextResponse.json({
      success: true,
      url: session.url
    });
  } catch (error) {
    console.error('Checkout session creation error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create checkout session'
    }, { status: 500 });
  }
} 