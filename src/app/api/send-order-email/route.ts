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

    const formatAddress = (shippingDetails: any) => {
      if (!shippingDetails?.address) return 'No shipping details provided';
      const addr = shippingDetails.address;
      return `
        ${shippingDetails.name}
        ${addr.line1}
        ${addr.line2 ? addr.line2 + '\n' : ''}
        ${addr.city}, ${addr.state} ${addr.postal_code}
        ${addr.country}
      `.trim();
    };

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
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin-bottom: 16px;">Thank you for your order!</h1>
            <div style="background-color: white; border-radius: 8px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color: #111827; font-size: 18px; font-weight: 500; margin-bottom: 16px;">Order Details</h2>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 8px;"><strong>Total:</strong> $${(orderDetails.amount_total / 100).toFixed(2)}</li>
                <li style="margin-bottom: 8px;"><strong>Design ID:</strong> ${orderDetails.metadata.designId}</li>
              </ul>
            </div>
            <p style="color: #4B5563; line-height: 1.5;">Your STEP file conversion will begin shortly. We'll email you the converted files when ready.</p>
          </div>
        `;
      } else {
        customerEmailHTML = `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin-bottom: 16px;">Thank you for your order!</h1>
            <div style="background-color: white; border-radius: 8px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="color: #111827; font-size: 18px; font-weight: 500; margin-bottom: 16px;">Order Details</h2>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin-bottom: 8px;"><strong>Total:</strong> $${(orderDetails.amount_total / 100).toFixed(2)}</li>
                <li style="margin-bottom: 8px;"><strong>Design ID:</strong> ${orderDetails.metadata.designId}</li>
                <li style="margin-bottom: 8px;"><strong>Material:</strong> ${orderDetails.metadata.material}</li>
                <li style="margin-bottom: 8px;"><strong>Size:</strong> ${orderDetails.metadata.size}</li>
                <li style="margin-bottom: 8px;"><strong>Quantity:</strong> ${orderDetails.metadata.quantity}</li>
                ${orderDetails.metadata.comments ? `<li style="margin-bottom: 8px;"><strong>Comments:</strong> ${orderDetails.metadata.comments}</li>` : ''}
              </ul>
            </div>
            ${orderDetails.shipping_details ? `
              <div style="background-color: white; border-radius: 8px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h2 style="color: #111827; font-size: 18px; font-weight: 500; margin-bottom: 16px;">Shipping Details</h2>
                <pre style="white-space: pre-wrap; font-family: system-ui, -apple-system, sans-serif; margin: 0;">${formatAddress(orderDetails.shipping_details)}</pre>
              </div>
            ` : ''}
            <p style="color: #4B5563; line-height: 1.5;">Your 3D printed item will be manufactured and shipped soon. Please await shipping confirmation.</p>
          </div>
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