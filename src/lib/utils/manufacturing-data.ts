export interface ManufacturingMethod {
  name: string;
  materials: string[];
  productTypes: string[];
  bestFor: string;
  advantages: string[];
  surfaceFinish: string;
  accuracy: string;
  strengthRating: number; // 1-5 scale
  detailRating: number; // 1-5 scale
  costRating: number; // 1-5 scale (1 being most affordable)
}

export const MANUFACTURING_METHODS: ManufacturingMethod[] = [
  {
    name: 'FDM 3D Printing',
    materials: ['PLA', 'ABS', 'PETG', 'TPU'],
    productTypes: [
      'Prototypes',
      'Custom models',
      'Functional parts',
      'Display items'
    ],
    bestFor: 'Affordable prototypes and functional parts with good structural strength',
    advantages: [
      'Most cost-effective option',
      'Wide range of materials',
      'Easy to post-process',
      'Good structural properties',
      'Fast turnaround time'
    ],
    surfaceFinish: 'Layer lines visible, can be smoothed',
    accuracy: '± 0.2mm',
    strengthRating: 4,
    detailRating: 3,
    costRating: 1
  },
  {
    name: 'Resin 3D Printing',
    materials: ['Standard Resin', 'Tough Resin', 'Clear Resin', 'Flexible Resin'],
    productTypes: [
      'High-detail models',
      'Jewelry prototypes',
      'Dental models',
      'Miniatures'
    ],
    bestFor: 'High-detail models requiring smooth surface finish and fine features',
    advantages: [
      'Excellent detail resolution',
      'Smooth surface finish',
      'Good for small features',
      'Clear material options',
      'Professional appearance'
    ],
    surfaceFinish: 'Very smooth, minimal layer lines',
    accuracy: '± 0.05mm',
    strengthRating: 3,
    detailRating: 5,
    costRating: 3
  },
  {
    name: 'SLS 3D Printing',
    materials: ['Nylon', 'TPU', 'PEEK', 'Carbon Fiber Nylon'],
    productTypes: [
      'End-use parts',
      'Complex assemblies',
      'Functional prototypes',
      'Durable goods'
    ],
    bestFor: 'Strong, durable parts with complex geometries and no support structures',
    advantages: [
      'No support structures needed',
      'Strong mechanical properties',
      'Complex geometries possible',
      'Professional finish',
      'Good for functional parts'
    ],
    surfaceFinish: 'Slightly grainy, uniform texture',
    accuracy: '± 0.1mm',
    strengthRating: 5,
    detailRating: 4,
    costRating: 4
  }
];

export function getRecommendedMethods(
  features: string[],
  preferredMaterial?: string
): {
  recommended: ManufacturingMethod[];
  reasoning: string;
} {
  // Bias towards FDM printing by giving it a higher base score
  const methodScores = MANUFACTURING_METHODS.map(method => {
    let score = method.name === 'FDM 3D Printing' ? 10 : 0; // Base score favoring FDM

    // Add points for material compatibility
    if (preferredMaterial && 
        method.materials.some(m => m.toLowerCase().includes(preferredMaterial.toLowerCase()))) {
      score += 5;
    }

    // Add points for feature compatibility
    features.forEach(feature => {
      if (method.productTypes.some(type => type.toLowerCase().includes(feature.toLowerCase()))) {
        score += 3;
      }
      // Additional points for specific features that match method strengths
      if (feature.toLowerCase().includes('detail') && method.detailRating > 3) {
        score += 2;
      }
      if (feature.toLowerCase().includes('strong') && method.strengthRating > 3) {
        score += 2;
      }
      if (feature.toLowerCase().includes('cheap') || feature.toLowerCase().includes('affordable')) {
        score += (5 - method.costRating) * 2; // More points for lower cost
      }
    });

    return { method, score };
  });

  // Sort by score and get recommended methods
  const sortedMethods = methodScores
    .sort((a, b) => b.score - a.score)
    .map(item => item.method);

  // Generate detailed reasoning for the top recommended method
  const topMethod = sortedMethods[0];
  const reasoning = `${topMethod.name} is recommended because: \n` +
    `• ${topMethod.bestFor}\n` +
    `• Key advantages: ${topMethod.advantages.slice(0, 3).join(', ')}\n` +
    `• Surface finish: ${topMethod.surfaceFinish}\n` +
    `• Accuracy: ${topMethod.accuracy}\n` +
    (preferredMaterial ? `• Compatible with your preferred material\n` : '') +
    `• ${topMethod.costRating === 1 ? 'Most cost-effective option' : 'Good value for the features provided'}`;

  return {
    recommended: sortedMethods,
    reasoning
  };
} 