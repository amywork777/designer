import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { glbUrl, designId } = await req.json();

    if (!glbUrl) {
      return NextResponse.json({ error: 'GLB URL is required' }, { status: 400 });
    }

    // Call the conversion service
    const response = await fetch('https://us-central1-taiyaki-test1.cloudfunctions.net/convert_to_stl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        glbUrl,
        designId,
        userId: session.user.id
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Conversion service error:', error);
      return NextResponse.json({ error: 'Failed to convert file' }, { status: 500 });
    }

    // Get the STL file as a blob
    const stlBlob = await response.blob();

    // Return the STL file
    return new NextResponse(stlBlob, {
      headers: {
        'Content-Type': 'application/sla',
        'Content-Disposition': `attachment; filename="${designId}.stl"`
      }
    });

  } catch (error) {
    console.error('Convert GLB error:', error);
    return NextResponse.json(
      { error: 'Failed to convert GLB to STL' },
      { status: 500 }
    );
  }
}