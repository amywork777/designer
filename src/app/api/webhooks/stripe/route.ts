import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
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
  try {
    const event = await verifyStripeWebhookEvent(req);
    const session = event.data.object;
    const metadata = session.metadata || {};
    
    const email = session.email;
    const userEmail = metadata.userEmail;
    const emailAddresses = [...new Set([email, userEmail].filter(Boolean))];
    
    if (emailAddresses.length === 0) {
      console.error('No email addresses found in session:', session);
      return NextResponse.json({ received: true });
    }

    // Different email templates based on order type
    let customerEmailHTML;
    if (metadata.orderType === 'STEP_FILE') {
      customerEmailHTML = `
        <h1>Thank you for your order!</h1>
        <p>Order Details:</p>
        <ul>
          <li>Total: $${(session.amount_total / 100).toFixed(2)}</li>
          <li>Design ID: ${metadata.designId}</li>
        </ul>
        <p>Your STEP file conversion will begin shortly. We'll email you the converted files when ready.</p>
      `;
    } else {
      customerEmailHTML = `
        <h1>Thank you for your order!</h1>
        <p>Order Details:</p>
        <ul>
          <li>Total: $${(session.amount_total / 100).toFixed(2)}</li>
          <li>Design ID: ${metadata.designId}</li>
          <li>Material: ${metadata.material}</li>
          <li>Size: ${metadata.size}</li>
          <li>Quantity: ${metadata.quantity}</li>
          ${metadata.comments ? `<li>Comments: ${metadata.comments}</li>` : ''}
        </ul>
        ${session.shipping_details ? `
          <h2>Shipping Details:</h2>
          <p>${JSON.stringify(session.shipping_details, null, 2)}</p>
        ` : ''}
        <p>Your 3D printed item will be manufactured and shipped soon. Please await shipping confirmation.</p>
      `;
    }

    // Send admin notification with full details
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'taiyaki.orders@gmail.com',
      subject: `New Order - ${metadata.orderType === 'STEP_FILE' ? 'STEP File' : '3D Manufacturing'}`,
      text: `
Order Details:
-------------
Order Type: ${metadata.orderType}
Session ID: ${session.id}
Customer Email: ${emailAddresses.join(', ')}
Amount: $${(session.amount_total / 100).toFixed(2)}
Design ID: ${metadata.designId}
${metadata.orderType === 'STEP_FILE' ? '' : `
Material: ${metadata.material}
Size: ${metadata.size}
Quantity: ${metadata.quantity}
Comments: ${metadata.comments || 'None'}

Shipping Details:
${session.shipping_details ? JSON.stringify(session.shipping_details, null, 2) : 'No shipping details provided'}`}
      `,
    });

    // Send customer confirmation email to all email addresses
    for (const emailAddress of emailAddresses) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: emailAddress,
        subject: 'Your Taiyaki Order Confirmation',
        html: customerEmailHTML,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
} 