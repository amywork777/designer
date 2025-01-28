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
  try {
    const event = await verifyStripeWebhookEvent(req);
    const session = event.data.object;
    const metadata = session.metadata || {};
    
    // Get all relevant data
    const email = session.email;
    const userEmail = metadata.userEmail;
    const comments = metadata.comments;
    const quantity = metadata.quantity;
    const shippingDetails = session.shipping_details;

    // Combine emails, removing duplicates and nulls
    const emailAddresses = [...new Set([email, userEmail].filter(Boolean))];
    
    if (emailAddresses.length === 0) {
      console.error('No email addresses found in session:', session);
      return NextResponse.json({ received: true });
    }

    const orderDetails = `
Order Details:
-------------
Order Type: ${metadata.orderType}
Session ID: ${session.id}
Customer Email: ${emailAddresses.join(', ')}
Amount: $${(session.amount_total / 100).toFixed(2)}

Design ID: ${metadata.designId}
Material: ${metadata.material}
Size: ${metadata.size}
Quantity: ${quantity}
Comments: ${comments || 'None'}

Shipping Details:
${shippingDetails ? JSON.stringify(shippingDetails, null, 2) : 'No shipping details provided'}
`;

    try {
      console.log('Attempting to send email with details:', orderDetails);
      
      // Send order notification email to admin
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: 'taiyaki.orders@gmail.com',
        subject: `New Order - ${metadata.orderType === 'STEP_FILE' ? 'STEP File' : '3D Manufacturing'}`,
        text: orderDetails,
      });
      
      // Send customer confirmation email using nodemailer to all email addresses
      const customerEmailHTML = `
        <h1>Thank you for your order!</h1>
        <p>Order Details:</p>
        <ul>
          <li>Order ID: ${session.id}</li>
          <li>Total: $${(session.amount_total / 100).toFixed(2)}</li>
          ${metadata.material ? `<li>Material: ${metadata.material}</li>` : ''}
          ${metadata.size ? `<li>Size: ${metadata.size}</li>` : ''}
          ${quantity ? `<li>Quantity: ${quantity}</li>` : ''}
          ${comments ? `<li>Comments: ${comments}</li>` : ''}
        </ul>
        ${shippingDetails ? `
        <h2>Shipping Details:</h2>
        <p>${JSON.stringify(shippingDetails, null, 2)}</p>
        ` : ''}
        <p>
          ${metadata.orderType === 'STEP_FILE' 
            ? 'Your STEP file will be processed and delivered within 1-2 business days.'
            : 'We will begin processing your manufacturing order right away. Please await shipping confirmation.'}
        </p>
      `;

      // Send to all found email addresses
      for (const emailAddress of emailAddresses) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: emailAddress,
          subject: 'Your Taiyaki Order Confirmation',
          html: customerEmailHTML,
        });
      }

    } catch (error) {
      console.error('Failed to send email:', error);
      return NextResponse.json({ received: true });
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