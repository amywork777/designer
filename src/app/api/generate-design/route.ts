import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { saveDesignToFirebase } from '@/lib/firebase/utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const BASE_SETTINGS = `Create a visually striking 3D model with these requirements:
- Soft, pleasing plain white background that complements the model
- 3/4 view angle to show depth while maintaining visual appeal
- Professional 3D rendering with attention to materials and textures
- Modern design aesthetic with careful attention to color harmony
- Dramatic lighting with soft shadows to add depth and atmosphere
- Smooth, refined surfaces with attention to detail
- Subtle ambient occlusion to ground the model
- Consider color psychology and emotional impact in the design
`;

const STYLE_PROMPTS = {
  cartoon: `Create a cute, stylized 3D model with these specific characteristics:
- Soft, rounded shapes with kawaii-inspired proportions
- Vibrant, pastel color palette
- Clean, smooth lines and surfaces
- Pixar-inspired character appeal
- Playful, chibi-style aesthetic
The model should be: `,

  realistic: `Create a photorealistic 3D model with these specific characteristics:
- Ultra-detailed surface textures
- Physically accurate 
- Proper depth 
- High-end rendering quality
The model should be: `,

  geometric: `Create a minimalist geometric 3D model with these specific characteristics:
- Clean, low-poly design aesthetic
- Sharp, precise angular planes
- Modern, abstract composition
- Metallic and chrome material finishes
- Origami-inspired structural elements
The model should be: `
};

const constructFullPrompt = (userPrompt: string, style?: string) => {
  // Start with base settings
  let fullPrompt = BASE_SETTINGS + '\n\n';

  // Add style prompt if style is specified and valid
  if (style) {
    const normalizedStyle = style.toLowerCase();
    const stylePrompt = STYLE_PROMPTS[normalizedStyle];
    if (stylePrompt) {
      fullPrompt += stylePrompt;
    }
  }

  // Add user prompt
  fullPrompt += userPrompt;

  return fullPrompt;
};

export async function POST(req: Request) {
  try {
    console.log('POST request received at /api/generate-design');
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is missing');
      return NextResponse.json({ 
        success: false, 
        error: 'OpenAI API key is not configured' 
      }, { status: 500 });
    }

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

    if (!prompt) {
      console.error('Prompt is missing');
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!userId) {
      console.error('User ID is missing');
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Construct the full prompt using the helper function
    const fullPrompt = constructFullPrompt(prompt, style);
    
    console.log('Prompt construction:', {
      originalPrompt: prompt,
      style,
      fullPrompt
    });

    let openAiResponse;
    try {
      openAiResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
        style: "vivid"
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

    // Save to Firebase with style information
    let savedDesign;
    try {
      savedDesign = await saveDesignToFirebase({
        imageUrl,
        prompt: fullPrompt,
        userId,
        mode: 'generated',
        style // Include the style information
      });
      console.log('Design saved to Firebase');
    } catch (e) {
      console.error('Firebase save error:', e);
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
      prompt: fullPrompt,
      style // Include style in the response
    });

  } catch (error: any) {
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