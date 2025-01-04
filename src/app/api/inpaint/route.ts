import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: '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',
});

async function base64ToFile(base64String: string, fileName: string): Promise<File> {
  try {
    // Ensure we're working with PNG data
    if (!base64String.startsWith('data:image/png;base64,')) {
      throw new Error('Image must be in PNG format');
    }
    
    // Remove data URL prefix
    const base64WithoutPrefix = base64String.replace('data:image/png;base64,', '');
    
    // Convert base64 to binary string
    const binaryString = atob(base64WithoutPrefix);
    
    // Create an array buffer from the binary string
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Check file size (4MB = 4 * 1024 * 1024 bytes)
    if (bytes.length > 4 * 1024 * 1024) {
      throw new Error('Image must be less than 4 MB');
    }
    
    // Create file from array buffer
    return new File([bytes], fileName, { type: 'image/png' });
  } catch (error) {
    console.error('Error converting base64 to file:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { imageUrl, mask, prompt } = await request.json();

    if (!imageUrl || !mask || !prompt) {
      return NextResponse.json(
        { error: 'Image URL, mask, and prompt are required' },
        { status: 400 }
      );
    }

    console.log('Converting images to files...');

    try {
      // Convert base64 images to files
      const [imageFile, maskFile] = await Promise.all([
        base64ToFile(imageUrl, 'image.png'),
        base64ToFile(mask, 'mask.png')
      ]);

      console.log('Image file size:', imageFile.size);
      console.log('Mask file size:', maskFile.size);

      if (imageFile.size === 0) {
        throw new Error('Image file is empty');
      }
      if (maskFile.size === 0) {
        throw new Error('Mask file is empty');
      }

      // Call DALL-E 3 API for inpainting
      console.log('Calling DALL-E API...');
      const response = await openai.images.edit({
        image: imageFile,
        mask: maskFile,
        prompt: prompt,
        n: 1,
        size: "1024x1024",
      });

      console.log('DALL-E response:', response);
      return NextResponse.json({ data: response.data });
    } catch (conversionError) {
      console.error('Error converting images:', conversionError);
      return NextResponse.json(
        { error: 'Failed to process images', details: conversionError instanceof Error ? conversionError.message : 'Unknown error' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing inpainting:', error);
    return NextResponse.json(
      { error: 'Failed to process inpainting', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}