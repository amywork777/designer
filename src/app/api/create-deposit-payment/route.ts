import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe only if API key is available
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-02-15' })
  : null;

export async function POST(req: Request) {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      console.warn('Stripe is not configured - proceeding without payment');
      return NextResponse.json({
        success: true,
        skipPayment: true,
        message: 'Payment processing is not configured - skipping payment step'
      });
    }

    // Parse request body
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // In production, fetch order details from database
    // For now, use mock data
    const orderDetails = {
      orderId,
      depositAmount: 250, // This would come from your database
      description: 'Manufacturing Order Deposit'
    };

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Deposit for Order ${orderId}`,
                description: 'Refundable manufacturing deposit'
              },
              unit_amount: orderDetails.depositAmount * 100 // Convert to cents
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/order-success?orderId=${orderId}&status=deposit_paid`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/order-success?orderId=${orderId}`,
        metadata: {
          orderId: orderId
        }
      });

      return NextResponse.json({ 
        success: true,
        url: session.url 
      });

    } catch (stripeError) {
      console.error('Stripe session creation error:', stripeError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create payment session',
          details: process.env.NODE_ENV === 'development' ? stripeError : undefined
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Payment processing error:', error);
    // Return a more user-friendly error
    return NextResponse.json(
      { 
        success: false, 
        error: 'Unable to process payment at this time. Please try again later.',
        skipPayment: true,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 503 }
    );
  }
} 