import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageUrl, prompt, quantity, considerations } = body;

    console.log('Received request with image URL:', imageUrl); // Debug log

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Create the messages array with proper typing
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "You are a manufacturing expert. Analyze the provided image and provide detailed specifications in the following format:\n\nProduct Description: [description]\nDimensions: [length] x [width] x [height] mm\nManufacturing Analysis: [analysis]"
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt || "Please analyze this product and provide detailed dimensions in millimeters (length x width x height). Include specific measurements for all key features and overall size."
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
    ];

    console.log('Sending request to OpenAI with messages:', JSON.stringify(messages, null, 2)); // Debug log

    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 500
    });

    const analysisText = visionResponse.choices[0]?.message?.content;
    console.log('Received analysis from OpenAI:', analysisText); // Debug log

    if (!analysisText) {
      throw new Error('No analysis generated from OpenAI');
    }

    // Extract dimensions and other information from the analysis
    const dimensionsMatch = analysisText.match(/Dimensions: (\d+\.?\d* x \d+\.?\d* x \d+\.?\d* mm)/i);
    const dimensions = dimensionsMatch ? dimensionsMatch[1] : null;

    // Extract product description
    const descriptionMatch = analysisText.match(/Product Description:(.*?)(?=Manufacturing Analysis:|$)/s);
    const productDescription = descriptionMatch ? descriptionMatch[1].trim() : '';

    // Generate mock manufacturing options for testing
    const manufacturingOptions = [
      {
        name: '3D Printing',
        description: 'Suitable for complex geometries and low volume production',
        costs: {
          setup: '$500',
          perUnit: '$50'
        },
        leadTime: '5-7 business days'
      },
      {
        name: 'CNC Machining',
        description: 'Ideal for precision parts and medium volume production',
        costs: {
          setup: '$1000',
          perUnit: '$100'
        },
        leadTime: '7-10 business days'
      }
    ];

    const analysis = {
      dimensions: dimensions || "Dimensions not found",
      productDescription: productDescription || "Description not found",
      manufacturingOptions,
      status: 'analyzed',
      analysisText
    };

    console.log('Sending response:', analysis); // Debug log

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Error in analyze-manufacturing API:', error);
    
    // Improved error response
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to analyze manufacturing options',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 