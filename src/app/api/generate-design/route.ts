import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { saveDesignToFirebase } from '@/lib/firebase/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BASE_SETTINGS = `Create a visually striking 3D model with these requirements:
- Soft, pleasing plain background that complements the model
- 3/4 view angle to show depth while maintaining visual appeal
- Professional 3D rendering with attention to materials and textures
- Modern design aesthetic with careful attention to color harmony
- Dramatic lighting with soft shadows to add depth and atmosphere
- Smooth, refined surfaces with attention to detail
- Subtle ambient occlusion to ground the model
- Consider color psychology and emotional impact in the design
`;

const STYLE_PROMPTS = {
  cartoon: `Create an adorable 3D model with these specific style elements:
- Kawaii-inspired design with extra cute proportions
- Soft, pastel color palette with gentle color gradients
- Rounded corners and playful shapes that spark joy
- Smooth, bubble-like surfaces that look soft to touch
- Playful shadows that enhance the cute aesthetic
The model should be: `,

  realistic: `Create a stunning photorealistic 3D model with these elements:
- Ultra-detailed surface textures with proper material properties
- Physical-based rendering with accurate reflections and refractions
- Careful attention to real-world material qualities
- Strategic depth of field to draw focus
- Atmospheric lighting that enhances realism
The model should be: `,

  geometric: `Create a bold geometric 3D model with these characteristics:
- Clean, minimal shapes with perfect proportions
- Bold, contrasting color choices that pop
- Precise angles and intentional geometry
- Subtle gradients to add visual interest
- Strategic use of negative space
- Polished surfaces with precise reflections
The model should be: `
};

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

    // 5. Construct the prompt with enhanced styling
    const stylePrompt = style ? STYLE_PROMPTS[style as keyof typeof STYLE_PROMPTS] || '' : '';
    const fullPrompt = `${BASE_SETTINGS}
    
${stylePrompt}
Design requirements: ${prompt}

Additional style notes:
- Ensure colors are vibrant and emotionally engaging
- Add subtle environmental touches that enhance the mood
- Consider the emotional impact of the lighting and colors
- Make deliberate choices about material properties
- Add small details that make the design more captivating`;

    console.log('Sending prompt to OpenAI:', fullPrompt);

    // 6. Call OpenAI with enhanced settings
    let openAiResponse;
    try {
      openAiResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",  // Changed to HD for better quality
        style: "vivid"  // Changed to vivid for more striking results
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