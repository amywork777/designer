import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { saveDesignToFirebase } from '@/lib/firebase/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BASE_SETTINGS = `Create a 3D model with these specific requirements:
- Pure white or transparent background, no environmental elements
- Isometric view to show depth and dimension
- Professional 3D rendering with clear details
- Clean, modern aesthetic
- High contrast lighting to emphasize depth
- Sharp, clear edges and surfaces
`;

export async function POST(req: Request) {
  try {
    const { prompt, style, originalDescription, userId } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const stylePrompt = style ? `Style: ${style}. ` : '';
    const fullPrompt = `${BASE_SETTINGS}
    
${stylePrompt}
Design requirements: ${prompt}

Remember: Maintain pure white/transparent background and isometric perspective.`;

    console.log('Sending prompt:', fullPrompt);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "natural"
    });

    const imageUrl = response.data[0]?.url;
    
    if (!imageUrl) {
      throw new Error('No image generated');
    }

    // Save to Firebase
    const savedDesign = await saveDesignToFirebase({
      imageUrl,
      prompt: fullPrompt,
      userId,
      mode: 'generated'
    });

    return NextResponse.json({ 
      success: true, 
      imageUrl: savedDesign.imageUrl,
      designId: savedDesign.id,
      prompt: fullPrompt
    });

  } catch (error: any) {
    console.error('Generation error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to generate image' 
    }, { status: 500 });
  }
} 