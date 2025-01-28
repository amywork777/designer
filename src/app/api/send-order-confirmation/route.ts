import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { orderType, orderDetails } = data;

    let emailContent;
    let subject;

    if (orderType === 'STEP_FILE') {
      subject = 'Your STEP File Order Confirmation';
      emailContent = `
        Thank you for your order!

        Order Details:
        Total: $${orderDetails.amount}
        Design ID: ${orderDetails.designId}

        Your STEP file conversion will begin shortly. We'll email you the converted files when ready.
      `;
    } else {
      // 3D Printing order
      subject = 'Your 3D Printing Order Confirmation';
      emailContent = `
        Thank you for your order!

        Order Details:
        Total: $${orderDetails.amount}
        Design ID: ${orderDetails.designId}
        Material: ${orderDetails.material}
        Size: ${orderDetails.size}
        Quantity: ${orderDetails.quantity}
        Comments: ${orderDetails.comments || 'None'}

        Shipping Details:
        Your 3D printed item will be manufactured and shipped soon. Please await shipping confirmation.
      `;
    }

    await resend.emails.send({
      from: 'Taiyaki <orders@taiyaki.com>',
      to: orderDetails.customerEmail,
      subject: subject,
      text: emailContent,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
} 