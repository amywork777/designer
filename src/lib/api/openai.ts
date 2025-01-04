import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateDesign(prompt: string) {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
    });
    
    return response.data[0].url;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
} 