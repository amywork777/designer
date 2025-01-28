import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { resend } from '@/lib/email';
import nodemailer from 'nodemailer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function POST(req: Request) {
  const body = await req.text();
  const sig = headers().get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig!, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      
      // Prepare email content based on order type
      let orderDetails = '';
      if (metadata.orderType === 'STEP_FILE') {
        orderDetails = `
Order Type: STEP File Purchase
Design ID: ${metadata.designId}
File Type: ${metadata.fileType}
Customer Email: ${session.customer_email}
Amount: $${(session.amount_total! / 100).toFixed(2)}
        `;
      } else {
        orderDetails = `
Order Type: 3D Manufacturing Order
Design ID: ${metadata.designId}
Material: ${metadata.material}
Size: ${metadata.size}
Quantity: ${metadata.quantity}
Comments: ${metadata.comments || 'None'}
Customer Email: ${session.customer_email}
Amount: $${(session.amount_total! / 100).toFixed(2)}

Shipping Address:
${session.shipping?.name}
${session.shipping?.address?.line1}
${session.shipping?.address?.line2 || ''}
${session.shipping?.address?.city}, ${session.shipping?.address?.state} ${session.shipping?.address?.postal_code}
United States
`;
      }

      // Send notification email to Taiyaki
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'taiyaki.orders@gmail.com',
        subject: `New Order - ${metadata.orderType === 'STEP_FILE' ? 'STEP File' : '3D Manufacturing'}`,
        text: orderDetails,
      });

      // Send customer confirmation email
      await resend.emails.send({
        from: 'Taiyaki <orders@taiyaki.studio>',
        to: session.customer_email!,
        subject: 'Your Taiyaki Order Confirmation',
        html: `
          <h1>Thank you for your order!</h1>
          <p>Order Details:</p>
          <ul>
            <li>Order ID: ${session.id}</li>
            <li>Total: $${(session.amount_total! / 100).toFixed(2)}</li>
            ${metadata.material ? `<li>Material: ${metadata.material}</li>` : ''}
            ${metadata.size ? `<li>Size: ${metadata.size}</li>` : ''}
            ${metadata.quantity ? `<li>Quantity: ${metadata.quantity}</li>` : ''}
          </ul>
          <p>
            ${metadata.orderType === 'STEP_FILE' 
              ? 'Your STEP file will be processed and delivered within 1-2 business days.'
              : 'We will begin processing your manufacturing order right away. Please await shipping confirmation.'}
          </p>
        `,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler failed:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
} 