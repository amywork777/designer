import { NextResponse } from 'next/server';
import { productStore } from '@/lib/store/products';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!params?.id) {
    return new NextResponse('Missing product ID', { status: 400 });
  }

  try {
    const product = productStore.getProduct(params.id);
    if (!product) {
      return new NextResponse('Product not found', { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!params?.id) {
    return new NextResponse('Missing product ID', { status: 400 });
  }

  try {
    const updates = await request.json();
    const product = productStore.getProduct(params.id);
    
    if (!product) {
      return new NextResponse('Product not found', { status: 404 });
    }

    const updatedProduct = {
      ...product,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    productStore.updateProduct(params.id, updatedProduct);
    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!params?.id) {
    return new NextResponse('Missing product ID', { status: 400 });
  }

  try {
    const success = productStore.deleteProduct(params.id);
    if (!success) {
      return new NextResponse('Product not found', { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting product:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 