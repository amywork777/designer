import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { userPrompt, tool, productType } = await request.json();

    const systemPrompt = `You are a professional product design engineer specializing in industrial design and manufacturing. 
Your task is to convert simple design modification requests into detailed, technical specifications.
Focus on physical properties, materials, and manufacturing-feasible modifications.
Be specific about measurements, materials, and finishes.
Keep the language clear and precise.`;

    const formatTemplate = `For a ${productType}, convert this request: "${userPrompt}" into a detailed specification following this structure:

${tool === 'select' ? `Transform the selected area to have the following properties:
- Material & Finish: [specify material, texture, and finish]
- Surface Treatment: [specify how it integrates with surrounding areas]
- Lighting Properties: [specify reflection, shadows, highlights]
- Manufacturing Details: [specify how it should appear manufactured]` 
: tool === 'add' ? `Add a new feature with these specifications:
- Feature Details: [precise description of what to add]
- Integration: [how it should blend with existing design]
- Material Match: [how materials should match existing product]
- Manufacturing Quality: [how it should appear manufactured]`
: `Remove the specified element with these considerations:
- Surface Continuation: [how surrounding material should fill the space]
- Texture Matching: [how to match surrounding texture]
- Edge Treatment: [how to handle transitions]
- Final Appearance: [how it should look when completed]`}

Keep the response focused and concise, emphasizing photorealistic quality and manufacturing feasibility.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: formatTemplate }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const enhancedPrompt = response.choices[0]?.message?.content;
    if (!enhancedPrompt) {
      throw new Error('Failed to generate enhanced prompt');
    }

    return NextResponse.json({ enhancedPrompt });
  } catch (error) {
    console.error('Error enhancing prompt:', error);
    return NextResponse.json(
      { error: 'Failed to enhance prompt', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 