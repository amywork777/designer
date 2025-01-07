import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Create the analysis prompt
    const analysisPrompt = `Analyze this 3D object and provide manufacturing recommendations. Focus on:
1. What is this object? (brief description)
2. Key features (complex geometry, fine details, structural requirements)
3. Best manufacturing method (FDM, Resin, or SLS printing) based on:
   - Required detail level
   - Structural needs
   - Geometric complexity
4. Recommended materials based on the chosen method

Format your response as:
Description: [1-2 sentences about the object]
Features: [list key features]
Recommended Method: [FDM/Resin/SLS] because [brief reason]
Suggested Materials: [list 2-3 materials]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: analysisPrompt },
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
      max_tokens: 500,
    });

    const analysis = response.choices[0].message.content;
    
    // Parse the analysis into structured data
    const sections = analysis.split('\n');
    const result = {
      description: sections.find(s => s.startsWith('Description:'))?.replace('Description:', '').trim() || '',
      features: sections.find(s => s.startsWith('Features:'))?.replace('Features:', '').trim().split(',').map(f => f.trim()) || [],
      recommendedMethod: sections.find(s => s.startsWith('Recommended Method:'))?.replace('Recommended Method:', '').split('because')[0].trim() || '',
      recommendedMaterials: sections.find(s => s.startsWith('Suggested Materials:'))?.replace('Suggested Materials:', '').trim().split(',').map(m => m.trim()) || []
    };

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Analysis failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze image' },
      { status: 500 }
    );
  }
} 