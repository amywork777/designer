import { NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: Request) {
  try {
    // Log headers for debugging
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));

    // Ensure the request is JSON
    const contentType = req.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { success: false, error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    // Parse request body with error handling
    let body;
    try {
      const rawBody = await req.text();
      console.log('Raw request body:', rawBody);
      body = JSON.parse(rawBody);
      console.log('Parsed request body:', body);
    } catch (e) {
      console.error('JSON parsing error:', e);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate and extract fields
    const { 
      productDescription, 
      manufacturingMethod, 
      volume,
      material,
      dimensions,
      estimatedCost 
    } = body;

    // Log extracted fields
    console.log('Extracted fields:', {
      productDescription,
      manufacturingMethod,
      volume,
      material,
      dimensions,
      estimatedCost
    });

    // Validate required fields
    if (!productDescription || !manufacturingMethod || !volume) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          received: { productDescription, manufacturingMethod, volume }
        },
        { status: 400 }
      );
    }

    // Generate order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create order object
    const order = {
      orderId,
      productDescription,
      manufacturingMethod,
      volume: Number(volume), // Ensure volume is a number
      material: material || 'Not specified',
      dimensions: dimensions || 'Not specified',
      estimatedCost: estimatedCost || { setup: 'Not specified', perUnit: 'Not specified' },
      status: 'pending_deposit',
      createdAt: new Date().toISOString(),
      depositAmount: calculateDeposit(Number(volume))
    };

    // Log created order
    console.log('Created order:', order);

    // Only attempt to send email if Resend is configured
    if (resend) {
      try {
        const emailResponse = await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: 'customer@email.com',
          subject: 'Manufacturing Order Confirmation',
          html: `
            <h1>Thank you for your order!</h1>
            <p>Order ID: ${orderId}</p>
            <p>Product: ${productDescription}</p>
            <p>Manufacturing Method: ${manufacturingMethod}</p>
            <p>Volume: ${volume} units</p>
            <p>Material: ${material || 'Not specified'}</p>
            <p>Estimated Setup Cost: ${estimatedCost?.setup || 'Not specified'}</p>
            <p>Estimated Cost Per Unit: ${estimatedCost?.perUnit || 'Not specified'}</p>
            <p>We're working hard to provide you with the best quote for your project.</p>
          `
        });
        console.log('Email sent successfully:', emailResponse);
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
        // Continue with order creation even if email fails
      }
    } else {
      console.log('Skipping email send - Resend not configured');
    }

    // Return successful response
    return NextResponse.json({ 
      success: true,
      ...order
    });

  } catch (error) {
    // Log detailed error information
    console.error('Order creation error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create order',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

function calculateDeposit(volume: number): number {
  const baseDeposit = 100;
  const volumeFactor = Math.ceil(volume / 100) * 50;
  return Math.min(baseDeposit + volumeFactor, 1000);
} 