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
    const { imageUrl, mode } = await req.json();
    console.log('Analyzing design, received URL:', imageUrl ? 'URL received' : 'No URL');

    let finalImageUrl = imageUrl;

    // Handle base64 images
    if (imageUrl.startsWith('data:image')) {
      finalImageUrl = imageUrl;
    } 
    // Handle http URLs
    else if (imageUrl.startsWith('http')) {
      finalImageUrl = imageUrl;
    } 
    else {
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
              content: "You are an expert in 3D design analysis. Provide a brief, 2-3 sentence description of the key visual elements and style of the design. Focus on the most distinctive features and overall aesthetic."
            },
            {
              role: "user",
              content: [
                { 
                  type: "text", 
                  text: "Describe this design's key visual elements and style in 2-3 sentences." 
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
          max_tokens: 150,
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