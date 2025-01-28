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
    const { material, designId, quantity, size, comments, userEmail } = await req.json();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'taiyaki.orders@gmail.com',
      subject: `Quote Request - Design ID: ${designId}`,
      text: `
Quote Request Details:
---------------------
Material/Method: ${material}
Design ID: ${designId}
Quantity: ${quantity}
Size: ${size}
Comments: ${comments}
User Email: ${userEmail}
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json(
      { error: 'Failed to send quote request' },
      { status: 500 }
    );
  }
} 