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
      title: "FDM 3D Printing",
      description: "Fused Deposition Modeling - Layer by layer plastic printing",
      idealFor: [
        "Functional prototypes",
        "Durable parts",
        "Cost-effective production"
      ],
      maxDimensions: {
        mm: { length: 250, width: 250, height: 300 },
        inches: { length: 9.8, width: 9.8, height: 11.8 }
      },
      materials: ["PLA", "ABS", "PETG", "TPU"],
      leadTime: "2-5 days",
      advantages: [
        "Most cost-effective option",
        "Wide range of materials",
        "Easy to post-process",
        "Good structural properties",
        "Fast turnaround time"
      ],
      surfaceFinish: "Layer lines visible, can be smoothed",
      accuracy: "± 0.2mm",
      strengthRating: 4,
      detailRating: 3,
      costRating: 1
    },
    {
      title: "Resin 3D Printing",
      description: "High-detail resin curing for smooth finish",
      idealFor: [
        "Detailed models",
        "Smooth surfaces",
        "Fine features"
      ],
      maxDimensions: {
        mm: { length: 200, width: 200, height: 250 },
        inches: { length: 7.9, width: 7.9, height: 9.8 }
      },
      materials: ["Standard Resin", "Tough Resin", "Clear Resin", "Flexible Resin"],
      leadTime: "2-4 days",
      advantages: [
        "Excellent detail resolution",
        "Smooth surface finish",
        "Good for small features",
        "Clear material options",
        "Professional appearance"
      ],
      surfaceFinish: "Very smooth, minimal layer lines",
      accuracy: "± 0.05mm",
      strengthRating: 3,
      detailRating: 5,
      costRating: 3
    },
    {
      title: "SLS 3D Printing",
      description: "Selective Laser Sintering for strong parts",
      idealFor: [
        "Complex geometries",
        "Strong parts",
        "No support needed"
      ],
      maxDimensions: {
        mm: { length: 300, width: 300, height: 300 },
        inches: { length: 11.8, width: 11.8, height: 11.8 }
      },
      materials: ["Nylon", "TPU", "PEEK", "Carbon Fiber Nylon"],
      leadTime: "3-7 days",
      advantages: [
        "No support structures needed",
        "Strong mechanical properties",
        "Complex geometries possible",
        "Professional finish",
        "Good for functional parts"
      ],
      surfaceFinish: "Slightly grainy, uniform texture",
      accuracy: "± 0.1mm",
      strengthRating: 5,
      detailRating: 4,
      costRating: 3
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

  const renderRating = (rating: number, label: string) => (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full mx-0.5 ${
              i <= rating ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500 ml-1">{label}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-blue-500" />
          <h3 className="text-xl font-bold text-gray-700">
            3D Printing Methods
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
                  <p className="text-sm font-medium text-gray-500">Lead Time</p>
                  <p className="text-gray-700">{method.leadTime}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Accuracy</p>
                  <p className="text-gray-700">{method.accuracy}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Surface Finish</p>
                <p className="text-gray-700">{method.surfaceFinish}</p>
              </div>

              <div className="mb-4 space-y-2">
                <p className="text-sm font-medium text-gray-500">Ratings</p>
                {renderRating(method.strengthRating, 'Strength')}
                {renderRating(method.detailRating, 'Detail')}
                {renderRating(6 - method.costRating, 'Cost-effectiveness')}
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Key Advantages</p>
                <ul className="list-disc list-inside text-gray-700">
                  {method.advantages.map((item, i) => (
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