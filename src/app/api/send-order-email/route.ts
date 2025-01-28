import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function POST(req: Request) {
  try {
    const { orderType, orderDetails, sessionId } = await req.json();

    // Get both email addresses and combine them
    const email = orderDetails.email;
    const userEmail = orderDetails.metadata?.userEmail;
    const emailAddresses = [...new Set([email, userEmail].filter(Boolean))];

    // Determine if this is a STEP file order - handle different case variations
    const isStepFile = ['STEP_FILE', 'step_file', 'STEP', 'step'].includes(
      orderType || orderDetails.metadata?.orderType || orderDetails.metadata?.fileType
    );

    // Admin notification email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'taiyaki.orders@gmail.com',
      subject: `New ${isStepFile ? 'STEP File' : '3D Manufacturing'} Order - Session ID: ${sessionId}`,
      text: `
Order Details:
-------------
Order Type: ${isStepFile ? 'STEP File' : '3D Manufacturing'}
Session ID: ${sessionId}
Customer Email: ${Array.isArray(emailAddresses) && emailAddresses.length > 0 ? emailAddresses.join(', ') : orderDetails.customer_email || 'No email provided'}
Amount: $${(orderDetails.amount_total / 100).toFixed(2)}
Design ID: ${orderDetails.metadata.designId}
${isStepFile ? 
  `File Type: STEP` : 
  `Material: ${orderDetails.metadata.material}
Size: ${orderDetails.metadata.size}
Quantity: ${orderDetails.metadata.quantity}
Comments: ${orderDetails.metadata.comments || 'None'}

Shipping Details:
${orderDetails.shipping_details ? JSON.stringify(orderDetails.shipping_details, null, 2) : 'No shipping details provided'}`}
      `,
    };

    // Send admin notification
    await transporter.sendMail(mailOptions);

    // Send customer confirmation to all email addresses
    if (emailAddresses.length > 0) {
      let customerEmailHTML;
      
      if (isStepFile) {
        customerEmailHTML = `
          <h1>Thank you for your order!</h1>
          <p>Order Details:</p>
          <ul>
            <li>Total: $${(orderDetails.amount_total / 100).toFixed(2)}</li>
            <li>Design ID: ${orderDetails.metadata.designId}</li>
          </ul>
          <p>Your STEP file conversion will begin shortly. We'll email you the converted files when ready.</p>
        `;
      } else {
        customerEmailHTML = `
          <h1>Thank you for your order!</h1>
          <p>Order Details:</p>
          <ul>
            <li>Total: $${(orderDetails.amount_total / 100).toFixed(2)}</li>
            <li>Design ID: ${orderDetails.metadata.designId}</li>
            <li>Material: ${orderDetails.metadata.material}</li>
            <li>Size: ${orderDetails.metadata.size}</li>
            <li>Quantity: ${orderDetails.metadata.quantity}</li>
            ${orderDetails.metadata.comments ? `<li>Comments: ${orderDetails.metadata.comments}</li>` : ''}
          </ul>
          ${orderDetails.shipping_details ? `
            <h2>Shipping Details:</h2>
            <p>${JSON.stringify(orderDetails.shipping_details, null, 2)}</p>
          ` : ''}
          <p>Your 3D printed item will be manufactured and shipped soon. Please await shipping confirmation.</p>
        `;
      }

      for (const emailAddress of emailAddresses) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: emailAddress,
          subject: 'Your Taiyaki Order Confirmation',
          html: customerEmailHTML,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json(
      { error: 'Failed to send order notification' },
      { status: 500 }
    );
  }
} 