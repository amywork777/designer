import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Add retry logic
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 2000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    console.log('Analyzing design, received URL:', imageUrl ? 'URL received' : 'No URL');

    if (!imageUrl) {
      throw new Error('No image URL provided');
    }

    // Process the image URL if it's base64
    let finalImageUrl = imageUrl;
    if (imageUrl.startsWith('data:image')) {
      console.log('Processing base64 image...');
      finalImageUrl = imageUrl;
    } else if (!imageUrl.startsWith('http')) {
      throw new Error('Invalid image URL format');
    }

    try {
      console.log('Calling OpenAI API...');
      const response = await retryOperation(async () => {
        return await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert in 3D design analysis. Provide an extremely detailed and specific analysis of the visual elements in this design.

              Focus on capturing:
              1. Exact shape details and geometry
              2. Specific proportions and dimensions
              3. Surface textures and patterns
              4. Key design features and their placement
              5. Overall style and artistic characteristics
              6. Material properties and visual effects
              
              Be precise and thorough - this description will be used as the primary reference for recreating this design.`
            },
            {
              role: "user",
              content: [
                { 
                  type: "text", 
                  text: "Analyze every visual detail of this design. Be specific and comprehensive." 
                },
                { 
                  type: "image_url", 
                  image_url: { 
                    url: finalImageUrl,
                    detail: "high"
                  } 
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.3
        });
      });

      console.log('OpenAI API response received');
      const description = response.choices[0]?.message?.content;
      
      if (!description) {
        console.error('No description in OpenAI response');
        throw new Error('Failed to get design description from OpenAI');
      }

      console.log('Analysis successful:', description.substring(0, 100) + '...');
      return NextResponse.json({ description });

    } catch (openAiError) {
      console.error('OpenAI API error:', openAiError);
      throw new Error(`OpenAI API error: ${openAiError.message}`);
    }

  } catch (error) {
    console.error('Design analysis error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to analyze design',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 