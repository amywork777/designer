import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendDesignEmail(designData: any, userEmail: string, paymentId: string) {
  const htmlContent = `
    <h2>New Design Manufacturing Request</h2>
    <p><strong>User Email:</strong> ${userEmail}</p>
    <p><strong>Payment ID:</strong> ${paymentId}</p>
    <h3>Design Details:</h3>
    <ul>
      <li><strong>Product Description:</strong> ${designData.analysis.description}</li>
      <li><strong>Recommended Method:</strong> ${designData.analysis.recommendedMethod}</li>
      <li><strong>Quantity:</strong> ${designData.quantity} units</li>
      <li><strong>Dimensions:</strong> ${designData.dimensions.length}x${designData.dimensions.width}x${designData.dimensions.height} ${designData.dimensions.unit}</li>
      <li><strong>Design Comments:</strong> ${designData.designComments || 'None'}</li>
    </ul>
  `;

  try {
    await resend.emails.send({
      from: 'Manufacturing <manufacturing@mobiussolutions.co>',
      to: process.env.ADMIN_EMAIL!,
      subject: `New Design Request - ${userEmail}`,
      html: htmlContent,
      attachments: [
        {
          filename: 'design.png',
          content: Buffer.from(designData.imageUrl.split(',')[1], 'base64')
        }
      ]
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
} 