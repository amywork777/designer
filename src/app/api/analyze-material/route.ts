import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Add retry logic
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

export async function POST(req: Request) {
  try {
    const { imageUrl } = await req.json();
    console.log('Starting material analysis...');

    if (!imageUrl) {
      throw new Error('No image URL provided');
    }

    // Default recommendation in case of failure
    const defaultRecommendation = {
      recommendedMaterial: "PLA",
      reason: "Default recommendation: PLA is the most versatile and cost-effective option for most 3D printing needs."
    };

    try {
      console.log('Calling OpenAI API...');
      const response = await retryOperation(async () => {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `Analyze this 3D model and recommend ONE material from these options ONLY:
                - PLA
                - Wood PLA
                - TPU
                - Resin
                - Aluminum
                
                Consider:
                - Detail level needed
                - Structural requirements
                - Intended use
                - Cost effectiveness
                
                Respond in this exact JSON format:
                {
                  "recommendedMaterial": "ONE OF THE EXACT MATERIALS LISTED ABOVE",
                  "reason": "A BRIEF, CLEAR EXPLANATION OF WHY THIS MATERIAL IS BEST"
                }`
            },
            {
              role: "user",
              content: [
                { 
                  type: "text", 
                  text: "Analyze this 3D model and recommend the best material." 
                },
                { 
                  type: "image_url", 
                  image_url: { 
                    url: imageUrl,
                    detail: "high"
                  } 
                }
              ]
            }
          ],
          max_tokens: 150,
          temperature: 0.3, // Lower temperature for more consistent responses
          response_format: { type: "json_object" }
        });

        console.log('OpenAI Response:', completion.choices[0]?.message?.content);
        return completion;
      }, 3, 2000);

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        console.warn('Empty response from OpenAI, using default');
        return NextResponse.json(defaultRecommendation);
      }

      try {
        const result = JSON.parse(content);
        console.log('Parsed result:', result);
        
        if (!result.recommendedMaterial || !result.reason) {
          console.warn('Missing fields in response:', result);
          return NextResponse.json(defaultRecommendation);
        }

        // Validate material
        const allowedMaterials = ['PLA', 'Wood PLA', 'TPU', 'Resin', 'Aluminum'];
        if (!allowedMaterials.includes(result.recommendedMaterial)) {
          console.warn('Invalid material recommended:', result.recommendedMaterial);
          return NextResponse.json(defaultRecommendation);
        }

        console.log('Successful recommendation:', result);
        return NextResponse.json(result);

      } catch (parseError) {
        console.error('Parse error:', parseError, 'Raw content:', content);
        return NextResponse.json(defaultRecommendation);
      }

    } catch (openAiError) {
      console.error('OpenAI API error:', openAiError);
      return NextResponse.json(defaultRecommendation);
    }

  } catch (error) {
    console.error('Material analysis error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to analyze material requirements',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 