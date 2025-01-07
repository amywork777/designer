import { NextResponse } from 'next/server';
import OpenAI from 'openai';

interface GenerateRequestBody {
  text?: string;
  image?: string;
  style?: 'cartoon' | 'realistic' | 'geometric';
  mode?: 'edit' | 'generate';
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

const STYLE_PROMPTS: Record<string, string> = {
  cartoon: "ultra-cute chibi style, soft rounded shapes, vibrant colors, clean lines",
  realistic: "photorealistic 3D render, detailed textures, physically accurate materials",
  geometric: "low-poly 3D model, clean geometric shapes, modern minimal style"
};

export async function POST(req: Request) {
  try {
    console.log('1. Generate/Edit endpoint hit');
    
    const body = await req.json() as GenerateRequestBody;
    const { text, image, style, mode } = body;

    let finalPrompt = '';
    let imageAnalysis = null;

    if (mode === 'edit' && image) {
      // Step 1: Analyze the current image with GPT-4V
      console.log('2a. Analyzing current image with GPT-4V');
      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a 3D artist. Analyze this 3D model and describe its key characteristics, materials, and style."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this 3D model's current appearance in detail." },
              { type: "image_url", image_url: { url: image, detail: "high" } }
            ]
          }
        ],
        max_tokens: 500
      });

      imageAnalysis = analysisResponse.choices[0]?.message?.content;
      if (!imageAnalysis) {
        throw new Error('Failed to analyze current design');
      }
      console.log('2b. Current design analysis:', imageAnalysis);

      // Step 2: Create prompt for the edited version
      console.log('3. Creating edit prompt');
      const editPromptResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a 3D artist. Create a DALL-E prompt that will maintain the core characteristics of the original design while incorporating the requested changes."
          },
          {
            role: "user",
            content: `Original design: ${imageAnalysis}
                     Requested changes: ${text}
                     ${style ? `Apply style: ${STYLE_PROMPTS[style]}` : ''}
                     Create a detailed prompt for DALL-E to generate the modified version.
                     The output should be a high-quality 3D model shown from a 3/4 isometric view angle with a clean background.`
          }
        ]
      });

      finalPrompt = editPromptResponse.choices[0]?.message?.content || '';
      console.log('3b. Edit prompt created:', finalPrompt);

    } else {
      // Regular generation
      console.log('2. Creating generation prompt');
      const promptResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a 3D artist. Create a detailed prompt for DALL-E to generate a 3D model."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Create a prompt for a 3D model with these requirements:
                      ${text ? `Description: ${text}` : ''}
                      ${style ? `Style: ${STYLE_PROMPTS[style]}` : ''}
                      The output should be a high-quality 3D model shown from a 3/4 isometric view angle with a clean background.`
              },
              ...(image ? [{
                type: "image_url",
                image_url: { url: image, detail: "high" }
              }] : [])
            ]
          }
        ]
      });

      finalPrompt = promptResponse.choices[0]?.message?.content || '';
    }

    if (!finalPrompt) {
      throw new Error('Failed to generate prompt');
    }

    // Generate image with DALL-E
    console.log('4. Calling DALL-E with prompt:', finalPrompt);
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "vivid"
    });

    console.log('5. DALL-E response received');

    return NextResponse.json({
      success: true,
      imageUrl: response.data[0].url,
      prompt: finalPrompt,
      analysis: imageAnalysis // Now this will be null for generation and contain analysis for edits
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate image',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 