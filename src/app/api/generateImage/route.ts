import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const STYLE_PROMPTS = {
  cartoon: "ultra-cute chibi style, soft rounded shapes, vibrant colors, clean lines",
  realistic: "photorealistic 3D render, detailed textures, physically accurate materials",
  geometric: "low-poly 3D model, clean geometric shapes, modern minimal style"
};

export async function POST(req: Request) {
  try {
    const { prompt, mode, inputImages, primaryImage, style, visionAnalysis } = await req.json();

    // If we have vision analysis and it's an edit mode, use it to inform the generation
    if (mode === 'edit' && visionAnalysis) {
      const { attributes } = visionAnalysis;
      
      // Ensure distinctive features is an array
      const distinctiveFeatures = Array.isArray(attributes.distinctive) 
        ? attributes.distinctive 
        : attributes.distinctive?.split(',') || [];
      
      // Construct a detailed prompt based on the analysis
      let generationPrompt = `Create a 3D model based on this reference: ${attributes.mainSubject}. `;
      generationPrompt += `Maintain its key characteristics: ${distinctiveFeatures.join(', ')}. `;
      
      // Add style modification if requested
      if (style && STYLE_PROMPTS[style]) {
        generationPrompt += `Transform it into a ${style} style with ${STYLE_PROMPTS[style]}. `;
      } else {
        generationPrompt += `Maintain its original ${attributes.style} style. `;
      }
      
      // Add any additional user requirements
      if (prompt) {
        generationPrompt += `Additional modifications: ${prompt}. `;
      }
      
      // Add consistent positioning and quality requirements
      generationPrompt += "Show the complete object from a 3/4 isometric view angle. Ensure high quality 3D rendering with clean background.";

      try {
        // Generate the new image
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: generationPrompt,
          n: 1,
          size: "1024x1024",
          quality: "hd",
          style: "vivid"
        });

        return NextResponse.json({
          success: true,
          imageUrl: response.data[0].url,
          prompt: generationPrompt
        });

      } catch (error) {
        console.error('Image generation error:', error);
        throw new Error('Failed to generate new image based on reference.');
      }
    } else {
      // Text-to-image generation without reference
      const basePrompt = style && STYLE_PROMPTS[style] 
        ? `${prompt}. Style: ${STYLE_PROMPTS[style]}. Show complete object from 3/4 isometric view.`
        : `${prompt}. Show complete object from 3/4 isometric view.`;

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: basePrompt,
        n: 1,
        size: "1024x1024",
        quality: "hd",
        style: "vivid"
      });

      return NextResponse.json({
        success: true,
        imageUrl: response.data[0].url,
        prompt: basePrompt
      });
    }

  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate image'
      },
      { status: 500 }
    );
  }
}
