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

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'taiyaki.orders@gmail.com',
      subject: `New ${orderType} Order - Session ID: ${sessionId}`,
      text: `
Order Details:
-------------
Order Type: ${orderType}
Session ID: ${sessionId}
Customer Email: ${orderDetails.customer_email}
Amount: $${(orderDetails.amount_total / 100).toFixed(2)}

${orderType === 'STEP_FILE' ? `
Design ID: ${orderDetails.metadata.designId}
File Type: ${orderDetails.metadata.fileType}
` : `
Design ID: ${orderDetails.metadata.designId}
Material: ${orderDetails.metadata.material}
Size: ${orderDetails.metadata.size}
`}
      `,
    };

    await transporter.sendMail(mailOptions);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json(
      { error: 'Failed to send order notification' },
      { status: 500 }
    );
  }
} 