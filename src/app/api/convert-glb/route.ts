import { NextResponse } from 'next/server';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { app } from '@/lib/firebase/config';

const BLENDER_SERVICE_URL = 'https://blender-service-815257559066.us-central1.run.app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { glbUrl, designId } = await req.json();
    console.log('Starting GLB conversion with URL:', glbUrl);

    // Call Blender service
    const response = await fetch(BLENDER_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        glbUrl: glbUrl,
        designId: designId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Blender service error:', errorText);
      throw new Error(errorText);
    }

    // Get the response which contains the Firebase Storage URL
    const data = await response.json();
    console.log('Received response:', data);

    if (!data.stlUrl) {
      throw new Error('No STL URL in response');
    }

    // Download the STL from Firebase Storage
    const stlResponse = await fetch(data.stlUrl);
    if (!stlResponse.ok) {
      throw new Error('Failed to download STL from storage');
    }

    const stlData = await stlResponse.arrayBuffer();
    console.log('Downloaded STL size:', stlData.byteLength);
    
    return new NextResponse(stlData, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${designId}.stl"`,
        'Content-Length': stlData.byteLength.toString()
      }
    });

  } catch (error: any) {
    console.error('Conversion error:', error);
    return NextResponse.json({ 
      error: 'Failed to convert GLB to STL',
      details: error.message 
    }, { status: 500 });
  }
}