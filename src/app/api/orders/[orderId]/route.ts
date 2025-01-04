import { NextResponse } from 'next/server';

// This endpoint will fetch order details
export async function GET(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = params.orderId;
    
    // Mock order details for now
    // In a real app, you would fetch this from your database
    const orderDetails = {
      orderId,
      productDescription: "Sample Product",
      manufacturingMethod: "3D Printing",
      estimatedTimeline: "2-3 weeks",
      depositAmount: 250,
      status: 'pending_deposit'
    };

    return NextResponse.json(orderDetails);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch order details' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { orderId: string } }
) {
  try {
    const orderId = params.orderId;
    const updates = await request.json();

    // In production, update the order in your database
    // For now, we'll just return the updated data
    const updatedOrder = {
      orderId,
      ...updates,
      status: 'pending_deposit'
    };

    return NextResponse.json(updatedOrder);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
} 