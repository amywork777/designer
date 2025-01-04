import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-02-15' })
  : null;

export async function POST(req: Request) {
  try {
    const { amount, manufacturingMethod, productDescription } = await req.json();

    // Check if Stripe is configured
    if (!stripe) {
      console.warn('Stripe is not configured - proceeding without payment');
      return NextResponse.json({
        success: true,
        skipPayment: true,
        message: 'Payment processing is not configured - skipping payment step'
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Design & Engineering Fee',
              description: `For ${manufacturingMethod} - ${productDescription || 'Custom Product'}`
            },
            unit_amount: amount * 100, // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email_collection: true,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order-confirmation?status=design_fee_paid&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/manufacturing`,
      metadata: {
        type: 'design_fee',
        manufacturingMethod,
        productDescription
      }
    });

    return NextResponse.json({
      success: true,
      url: session.url
    });
  } catch (error) {
    console.error('Payment setup error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unable to process payment at this time. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 503 }
    );
  }
} 