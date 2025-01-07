import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { userPrompt, tool, productType } = await request.json();

    const systemPrompt = `You are a professional 3D artist specializing in creating appealing 3D models.
Your task is to convert simple design requests into detailed visual descriptions.`;

    const formatTemplate = `For this design request: "${userPrompt}", create a detailed visual description following this structure:

${tool === 'select' ? `Modify the selected area with these design elements:` : `Modify this part of the design:`}

Keep the response focused on creating an appealing and cohesive 3D model.`;

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