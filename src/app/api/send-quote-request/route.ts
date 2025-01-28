import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, material, size, quantity, designId, comments } = await req.json();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'taiyaki.orders@gmail.com',
      subject: 'New Quote Request',
      html: `
        <h2>New Quote Request</h2>
        <p><strong>Customer Email:</strong> ${email}</p>
        <p><strong>Material:</strong> ${material}</p>
        <p><strong>Size:</strong> ${size}</p>
        <p><strong>Quantity:</strong> ${quantity}</p>
        <p><strong>Design ID:</strong> ${designId}</p>
        <p><strong>Comments:</strong> ${comments}</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Quote request error:', error);
    return NextResponse.json(
      { error: 'Failed to send quote request' },
      { status: 500 }
    );
  }
} 