import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { title, description } = await req.json();

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    // Update the product with title, description and set it as published
    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        title,
        description,
        status: 'published',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      product,
      message: 'Product published successfully'
    });

  } catch (error) {
    console.error('Error publishing product:', error);
    return NextResponse.json(
      { 
        error: 'Failed to publish product',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Add GET endpoint to fetch product details
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      product
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
} 