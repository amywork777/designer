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

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'taiyaki.orders@gmail.com',
        subject: `New ${orderType} Order - Session ID: ${sessionId}`,
        text: `
      Order Details:
      -------------
      Order Type: ${orderType}
      Session ID: ${sessionId}
      Customer Email: ${Array.isArray(emailAddresses) && emailAddresses.length > 0 ? emailAddresses.join(', ') : orderDetails.customer_email || 'No email provided'}
      Amount: $${(orderDetails.amount_total / 100).toFixed(2)}
      
      Design ID: ${orderDetails.metadata.designId}
      ${orderType === 'STEP_FILE' ? 
        `File Type: ${orderDetails.metadata.fileType || 'STEP'}` : 
        `Material: ${orderDetails.metadata.material}
      Size: ${orderDetails.metadata.size}
      Quantity: ${orderDetails.metadata.quantity}`}
      Comments: ${orderDetails.metadata.comments || 'None'}
      
      Shipping Details:
      ${orderDetails.shipping_details ? JSON.stringify(orderDetails.shipping_details, null, 2) : 'No shipping details provided'}
      `,
      };

    // Send admin notification
    await transporter.sendMail(mailOptions);

    // Send customer confirmation to all email addresses
    if (emailAddresses.length > 0) {
      const customerEmailHTML = `
        <h1>Thank you for your order!</h1>
        <p>Order Details:</p>
        <ul>
          <li>Order ID: ${sessionId}</li>
          <li>Total: $${(orderDetails.amount_total / 100).toFixed(2)}</li>
          <li>Design ID: ${orderDetails.metadata.designId}</li>
          ${orderType === 'STEP_FILE' 
            ? `<li>File Type: ${orderDetails.metadata.fileType || 'STEP'}</li>`
            : `
              <li>Material: ${orderDetails.metadata.material}</li>
              <li>Size: ${orderDetails.metadata.size}</li>
              <li>Quantity: ${orderDetails.metadata.quantity}</li>
            `}
          ${orderDetails.metadata.comments ? `<li>Comments: ${orderDetails.metadata.comments}</li>` : ''}
        </ul>
        ${orderDetails.shipping_details ? `
        <h2>Shipping Details:</h2>
        <p>${JSON.stringify(orderDetails.shipping_details, null, 2)}</p>
        ` : ''}
        <p>
          ${orderType === 'STEP_FILE' 
            ? 'Your STEP file will be processed and delivered within 1-2 business days.'
            : 'We will begin processing your manufacturing order right away. Please await shipping confirmation.'}
        </p>
      `;

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