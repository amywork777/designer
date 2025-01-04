export interface ManufacturingMethod {
  name: string;
  materials: string[];
  volumeRange: string | {
    min: number;
    max: number;
  };
  productTypes: string[];
  bestFor: string;
}

export const MANUFACTURING_METHODS: ManufacturingMethod[] = [
  {
    name: '3D Printing (FDM)',
    materials: ['PLA', 'ABS', 'PETG', 'Nylon'],
    volumeRange: '1-100 units',
    productTypes: [
      'Prototypes',
      'Custom figurines',
      'Small mechanical parts',
      'Enclosures',
      'Basic functional shapes'
    ],
    bestFor: 'Personalized figurines, funky keychains, custom robot parts, unique phone stands, quirky lampshades'
  },
  {
    name: 'CNC Machining',
    materials: ['Aluminum', 'Steel', 'Wood', 'Plastics (Acrylic)'],
    volumeRange: '1-500 units',
    productTypes: [
      'Precision components',
      'Mechanical parts',
      'Brackets',
      'Tooling',
      'Decorative items'
    ],
    bestFor: 'Precision drone parts, luxury pen holders, sleek metal wallets, custom skateboard trucks'
  },
  {
    name: 'Laser Cutting',
    materials: ['Metals (Steel, Aluminum)', 'Plastics', 'Wood'],
    volumeRange: '1-1,000 units',
    productTypes: [
      'Flat components',
      'Stencils',
      'Signage',
      'Decorative panels',
      'Gears',
      'Structural frames'
    ],
    bestFor: 'Fancy nameplates, intricate jewelry, artsy coasters, cool wall décor, stylish laptop stands'
  },
  {
    name: 'Sheet Metal Fabrication',
    materials: ['Aluminum', 'Stainless Steel', 'Galvanized Steel'],
    volumeRange: '10-500 units',
    productTypes: [
      'Enclosures',
      'Brackets',
      'Panels',
      'Metal casings',
      'Frames',
      'Hardware'
    ],
    bestFor: 'Sturdy bike racks, industrial lamp bases, modern planter boxes, edgy furniture frames'
  },
  {
    name: 'Injection Molding',
    materials: ['ABS', 'Polypropylene', 'Nylon'],
    volumeRange: '500-10,000+ units',
    productTypes: [
      'Plastic housings',
      'Electronics enclosures',
      'Appliance parts',
      'Containers',
      'Caps',
      'Toys',
      'Consumer products'
    ],
    bestFor: 'Trendy sunglasses, colorful stacking toys, eco-friendly food containers, funky plastic chairs'
  },
  {
    name: 'Die Casting',
    materials: ['Aluminum', 'Zinc', 'Magnesium'],
    volumeRange: '1,000-10,000+ units',
    productTypes: [
      'Metal housings',
      'Automotive components',
      'Hardware',
      'Knobs',
      'Handles',
      'Heat sinks',
      'Gears'
    ],
    bestFor: 'Shiny car door handles, sturdy bottle openers, heat-dissipating laptop coolers, fancy chess pieces'
  }
];

export function getRecommendedMethods(
  features: string[],
  volume: number,
  preferredMaterial?: string
): {
  recommended: ManufacturingMethod[];
  reasoning: string;
} {
  const compatibleMethods = MANUFACTURING_METHODS.filter(method => {
    // Check volume constraints
    let volumeCompatible = false;
    if (typeof method.volumeRange === 'string') {
      const [min, max] = method.volumeRange.split('-').map(v => parseInt(v));
      volumeCompatible = volume >= min && (!max || volume <= max);
    } else {
      volumeCompatible = volume >= method.volumeRange.min && volume <= method.volumeRange.max;
    }
    
    // Check material compatibility if preferred material is specified
    const materialCompatible = !preferredMaterial || 
      method.materials.some(m => m.toLowerCase().includes(preferredMaterial.toLowerCase()));

    // Check feature compatibility
    const featureCompatible = features.some(feature =>
      method.productTypes.some(type => 
        type.toLowerCase().includes(feature.toLowerCase())
      )
    );

    return volumeCompatible && materialCompatible && featureCompatible;
  });

  // Generate reasoning
  const reasoning = `Based on the identified features (${features.join(', ')}), ` +
    `production volume of ${volume} units, ` +
    (preferredMaterial ? `preferred material of ${preferredMaterial}, ` : '') +
    `the following manufacturing methods are recommended. ` +
    `These methods align with the product characteristics and production requirements.`;

  return {
    recommended: compatibleMethods,
    reasoning
  };
} 