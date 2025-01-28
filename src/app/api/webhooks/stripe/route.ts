import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { Resend } from 'resend';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

const resend = new Resend(process.env.RESEND_API_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const NOTIFICATION_EMAIL = 'amy@mobiussolutions.co';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get('stripe-signature');

    console.log('=== WEBHOOK DEBUG START ===');
    console.log('Webhook type:', JSON.parse(body).type);
    console.log('Webhook secret used:', endpointSecret.slice(0, 10) + '...');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig!, endpointSecret);
      console.log('Event constructed successfully:', event.type);
    } catch (err) {
      console.error('Webhook verification failed:', err);
      return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
    }

    // Handle both checkout.session.completed and charge.succeeded
    if (event.type === 'checkout.session.completed' || event.type === 'charge.succeeded') {
      let metadata = {};
      let amount = 0;
      let customerEmail = '';

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        metadata = session.metadata || {};
        amount = session.amount_total || 0;
        customerEmail = session.customer_details?.email || '';
      } else if (event.type === 'charge.succeeded') {
        const charge = event.data.object as Stripe.Charge;
        metadata = charge.metadata || {};
        amount = charge.amount;
        customerEmail = charge.billing_details?.email || '';
      }

      console.log('Processing payment:', {
        type: event.type,
        metadata,
        amount,
        customerEmail
      });

      try {
        if (event.type === 'checkout.session.completed') {
          const session = event.data.object;
          
          // Send custom email
          await resend.emails.send({
            from: 'Taiyaki <orders@taiyaki.studio>',
            to: session.customer_email,
            subject: 'Your Taiyaki Order Confirmation',
            html: `
              <h1>Thank you for your order!</h1>
              <p>Order Details:</p>
              <ul>
                <li>Order ID: ${session.id}</li>
                <li>Total: $${(session.amount_total / 100).toFixed(2)}</li>
                ${session.metadata.material ? `<li>Material: ${session.metadata.material}</li>` : ''}
                ${session.metadata.size ? `<li>Size: ${session.metadata.size}</li>` : ''}
              </ul>
              <p>We'll start processing your order right away
              For manufacturing orders, please await shipping confirmation.
              For STEP file purchases, please allow 1-2 business days for processing.
              For quotes, please allow 1-2 business days for processing.</p>
            `
          });
        }
      } catch (emailError: any) {
        console.error('Failed to send email:', {
          error: emailError.message,
          code: emailError.code
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
} 