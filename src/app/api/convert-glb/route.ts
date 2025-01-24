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

    // Get the download URL from Firebase Storage
    const storage = getStorage(app);
    const urlPath = glbUrl.split('/processed/')[1];
    const storagePath = `processed/${urlPath}`;
    
    let downloadUrl;
    try {
      const glbRef = ref(storage, storagePath);
      downloadUrl = await getDownloadURL(glbRef);
    } catch (error: any) {
      console.error('Error getting download URL:', error);
      return NextResponse.json({ 
        error: 'Failed to get download URL',
        details: error.message 
      }, { status: 400 });
    }

    // Call Blender service with exact format it expects
    const response = await fetch(BLENDER_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        glbUrl: downloadUrl,  // Matches the exact key expected
        designId: designId    // Matches the exact key expected
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Blender service error:', errorText);
      throw new Error(errorText);
    }

    // Your service returns the STL file directly
    const stlData = await response.arrayBuffer();
    
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