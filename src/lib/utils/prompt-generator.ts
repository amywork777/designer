interface StyleModifier {
  name: string;
  description: string;
  promptAddition: string;
}

// Add interface for PromptOptions
interface PromptOptions {
  productType: string;
  size?: {
    width?: number;
    height?: number;
    depth?: number;
    unit: 'mm' | 'inches';
  };
  style?: string;
  material?: string;
  additionalDetails?: string;
}

const DESIGN_FOCUS_PROMPTS = [
  'centered composition',
  'clean white background',
  'high quality'
];

const STYLE_MODIFIERS: StyleModifier[] = [
  {
    name: 'Cartoon',
    description: 'Adorable chibi character',
    promptAddition: 'chibi character, extremely cute, large round glossy eyes, small body, soft round shapes, kawaii style, Pixar-inspired, pastel colors, smooth shading'
  },
  {
    name: 'Realistic',
    description: 'Photorealistic portrait',
    promptAddition: 'ultra realistic, detailed fur texture, studio lighting, shallow depth of field, soft focus background, high-end photography, natural pose'
  },
  {
    name: 'Geometric',
    description: 'Modern polygon sculpture',
    promptAddition: 'low poly art, metallic finish, sharp angular planes, chrome and gold surfaces, origami-inspired, modern sculpture, faceted design'
  }
];

export function generateStructuredPrompt(options: PromptOptions): string {
  const { productType, style } = options;

  // Base prompt
  let prompt = `${productType}, ${DESIGN_FOCUS_PROMPTS.join(', ')}. Temperature 0.05. `;

  // Add style modifier if specified
  if (style) {
    const styleModifier = STYLE_MODIFIERS.find(mod => mod.name.toLowerCase() === style.toLowerCase());
    if (styleModifier) {
      prompt += styleModifier.promptAddition;
    }
  }

  return prompt;
}

export function getMaterialRecommendations(productType: string): string[] {
  // Material recommendations optimized for figurines
  const recommendations: Record<string, string[]> = {
    'miniature': ['Resin', 'PLA+'],
    'action figure': ['PETG', 'PLA+', 'ABS'],
    'statue': ['PLA+', 'PETG'],
    'bust': ['PLA+', 'Resin'],
    'default': ['PLA+', 'Resin']
  };

  const matchingType = Object.keys(recommendations).find(
    type => productType.toLowerCase().includes(type)
  );

  return recommendations[matchingType || 'default'];
} 