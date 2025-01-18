import { analyzeImage } from './imageAnalysis';

interface MaterialRecommendation {
  recommendedMaterial: string;
  reason: string;
}

export async function getMaterialRecommendation(imageUrl: string): Promise<MaterialRecommendation> {
  try {
    // Get image analysis results
    const analysis = await analyzeImage(imageUrl);
    
    // Default recommendation
    let recommendedMaterial = 'PLA';
    let reason = 'Standard material suitable for most designs';

    // Determine material based on analysis
    if (analysis) {
      const { complexity, features = [], category = '' } = analysis;

      if (category === 'mechanical' || features.includes('functional')) {
        recommendedMaterial = 'TPU';
        reason = 'Flexible material recommended for functional parts';
      } else if (complexity === 'high' || features.includes('detailed')) {
        recommendedMaterial = 'Resin';
        reason = 'High detail material for complex designs';
      } else if (features.includes('decorative') || features.includes('display')) {
        recommendedMaterial = 'Wood PLA';
        reason = 'Aesthetic material perfect for decorative items';
      }
    }

    return {
      recommendedMaterial,
      reason
    };
  } catch (error) {
    console.error('Error getting material recommendation:', error);
    throw new Error('Failed to generate material recommendation');
  }
} 