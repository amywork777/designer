import { Package, Info } from 'lucide-react';

interface RecommendationProps {
  onMethodSelect: (method: string) => void;
  productDimensions: {
    length: number;
    width: number;
    height: number;
    unit: 'mm' | 'inches';
  };
  productDescription?: string;
}

export function ManufacturingRecommendations({ 
  onMethodSelect, 
  productDimensions,
  productDescription 
}: RecommendationProps) {
  const MANUFACTURING_METHODS = [
    {
      title: "3D Printing (FDM)",
      description: "Perfect for prototypes and small production runs",
      volumeRange: "1-100 units",
      idealFor: [
        "Complex geometries",
        "Rapid prototyping",
        "Custom designs"
      ],
      maxDimensions: {
        mm: { length: 250, width: 250, height: 300 },
        inches: { length: 9.8, width: 9.8, height: 11.8 }
      },
      materials: ["PLA", "ABS", "PETG", "TPU"],
      leadTime: "2-5 days"
    },
    {
      title: "CNC Machining",
      description: "High precision for metal and plastic parts",
      volumeRange: "1-1000 units",
      idealFor: [
        "High precision parts",
        "Metal components",
        "Complex geometries"
      ],
      maxDimensions: {
        mm: { length: 300, width: 300, height: 300 },
        inches: { length: 11.8, width: 11.8, height: 11.8 }
      },
      materials: ["Aluminum", "Steel", "Brass", "Plastics"],
      leadTime: "5-10 days"
    },
    {
      title: "Laser Cutting",
      description: "Fast and precise for flat materials",
      volumeRange: "10-1000 units",
      idealFor: [
        "Sheet metal parts",
        "Precise cuts",
        "2D designs"
      ],
      maxDimensions: {
        mm: { length: 300, width: 300, height: 10 },
        inches: { length: 11.8, width: 11.8, height: 0.4 }
      },
      materials: ["Sheet metal", "Acrylic", "Wood"],
      leadTime: "2-5 days"
    }
  ];

  // Filter methods based on dimensions
  const compatibleMethods = MANUFACTURING_METHODS.filter(method => {
    const maxDims = method.maxDimensions[productDimensions.unit];
    return (
      productDimensions.length <= maxDims.length &&
      productDimensions.width <= maxDims.width &&
      productDimensions.height <= maxDims.height
    );
  });

  return (
    <div className="space-y-6">
      <div className="space-y-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-blue-500" />
          <h3 className="text-xl font-bold text-gray-700">
            Recommended Manufacturing Methods
          </h3>
        </div>

        <div className="space-y-4">
          {compatibleMethods.map((method, index) => (
            <div key={index} className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-lg font-bold text-gray-700 mb-2">
                {method.title}
              </h4>
              <p className="text-gray-600 mb-3">{method.description}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Volume Range</p>
                  <p className="text-gray-700">{method.volumeRange}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Lead Time</p>
                  <p className="text-gray-700">{method.leadTime}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Ideal For</p>
                <ul className="list-disc list-inside text-gray-700">
                  {method.idealFor.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Available Materials</p>
                <div className="flex flex-wrap gap-2">
                  {method.materials.map((material, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                      {material}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onMethodSelect(method.title)}
                className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Select {method.title}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 