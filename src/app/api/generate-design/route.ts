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
    // 1. Log the incoming request
    console.log('POST request received at /api/generate-design');
    
    // 2. Check if OpenAI API key exists
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is missing');
      return NextResponse.json({ 
        success: false, 
        error: 'OpenAI API key is not configured' 
      }, { status: 500 });
    }

    // 3. Parse request body with error handling
    let body;
    try {
      body = await req.json();
      console.log('Request body:', {
        promptLength: body.prompt?.length,
        style: body.style,
        userId: body.userId
      });
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request body' 
      }, { status: 400 });
    }

    const { prompt, style, userId } = body;

    // 4. Validate required fields
    if (!prompt) {
      console.error('Prompt is missing');
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!userId) {
      console.error('User ID is missing');
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 5. Construct the prompt
    const stylePrompt = style ? `Style: ${style}. ` : '';
    const fullPrompt = `${BASE_SETTINGS}
    
${stylePrompt}
Design requirements: ${prompt}

Remember: Maintain pure white/transparent background and isometric perspective.`;

    console.log('Sending prompt to OpenAI:', fullPrompt);

    // 6. Call OpenAI with error handling
    let openAiResponse;
    try {
      openAiResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural"
      });
      console.log('OpenAI response received');
    } catch (e) {
      console.error('OpenAI API error:', e);
      return NextResponse.json({ 
        success: false, 
        error: e instanceof Error ? e.message : 'OpenAI API error'
      }, { status: 500 });
    }

    const imageUrl = openAiResponse.data[0]?.url;
    
    if (!imageUrl) {
      console.error('No image URL in OpenAI response');
      throw new Error('No image generated');
    }

    // 7. Save to Firebase with error handling
    let savedDesign;
    try {
      savedDesign = await saveDesignToFirebase({
        imageUrl,
        prompt: fullPrompt,
        userId,
        mode: 'generated'
      });
      console.log('Design saved to Firebase');
    } catch (e) {
      console.error('Firebase save error:', e);
      // Still return the image URL even if Firebase save fails
      return NextResponse.json({ 
        success: true, 
        imageUrl: imageUrl,
        error: 'Failed to save to database'
      });
    }

    return NextResponse.json({ 
      success: true, 
      imageUrl: savedDesign.imageUrl,
      designId: savedDesign.id,
      prompt: fullPrompt
    });

  } catch (error: any) {
    // 8. Enhanced error logging
    console.error('Generation error:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to generate image',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}