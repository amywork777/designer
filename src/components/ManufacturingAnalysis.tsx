import React, { useState } from 'react';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';
import { SIZES } from '@/lib/types/sizes';

interface ManufacturingAnalysisProps {
  imageUrl: string;
  existingAnalysis?: {
    description?: string;
    features?: string[];
    recommendedMethod?: string;
    recommendedMaterials?: string[];
  };
  onAnalysisComplete: (analysis: any) => void;
  onRedoAnalysis: () => void;
  quantity: number;
  onQuantityChange: (value: number) => void;
  dimensions: {
    size: string;
    unit: string;
  };
  onDimensionsChange: (dimensions: any) => void;
  isRedoing: boolean;
  designComments: string;
  onCommentsChange: (comments: string) => void;
}

export function ManufacturingAnalysis({
  imageUrl,
  existingAnalysis = {
    recommendedMethod: 'FDM 3D Printing'
  },
  onAnalysisComplete,
  onRedoAnalysis,
  quantity,
  onQuantityChange,
  dimensions,
  onDimensionsChange,
  isRedoing,
  designComments,
  onCommentsChange
}: ManufacturingAnalysisProps) {
  const [isDimensionsExpanded, setIsDimensionsExpanded] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(SIZES[1].name);
  
  const currentPreset = SIZES.find(p => p.name === selectedPreset);
  const currentReference = currentPreset?.description || '';

  React.useEffect(() => {
    if (!dimensions.length && !dimensions.width && !dimensions.height) {
      onDimensionsChange({
        length: 0,
        width: 0,
        height: 0,
        unit: dimensions.unit || 'mm'
      });
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            Manufacturing Analysis
          </h3>
        </div>
        
        <div className="space-y-4">
          {/* Description */}
          {existingAnalysis.description && (
            <div className="bg-white rounded-lg p-3">
              <h4 className="font-medium text-gray-900 mb-2">Description</h4>
              <p className="text-gray-700">{existingAnalysis.description}</p>
            </div>
          )}

          {/* Features */}
          {existingAnalysis.features && existingAnalysis.features.length > 0 && (
            <div className="bg-white rounded-lg p-3">
              <h4 className="font-medium text-gray-900 mb-2">Key Features</h4>
              <ul className="list-disc list-inside text-gray-700">
                {existingAnalysis.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Materials */}
          {existingAnalysis.recommendedMaterials && existingAnalysis.recommendedMaterials.length > 0 && (
            <div className="bg-white rounded-lg p-3">
              <h4 className="font-medium text-gray-900 mb-2">Recommended Materials</h4>
              <div className="flex flex-wrap gap-2">
                {existingAnalysis.recommendedMaterials.map((material, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-50 rounded-full text-sm text-gray-700">
                    {material}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selection */}
          <div className="bg-white rounded-lg p-3">
            <h4 className="font-medium text-gray-900 mb-2">Quantity</h4>
            <input
              type="number"
              value={quantity}
              onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
              min="1"
              className="w-full px-3 py-2 border rounded-lg text-gray-800"
            />
          </div>

          {/* Size & Dimensions */}
          <div className="bg-white rounded-lg p-3">
            <h4 className="font-medium text-gray-900 mb-2">Size Selection</h4>
            
            <div className="space-y-2">
              <select
                value={dimensions.size || ''}
                onChange={(e) => onDimensionsChange({
                  size: e.target.value,
                  unit: 'inches'
                })}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select size...</option>
                {SIZES.map((size) => (
                  <option key={size.name} value={size.name}>
                    {size.name} ({size.dimensions})
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500">
                {SIZES.find(s => s.name === dimensions.size)?.description || 
                 'Select a size to see its description'}
              </p>
            </div>
          </div>

          {/* Additional Comments */}
          <div className="bg-white rounded-lg p-3">
            <h4 className="font-medium text-gray-900 mb-2">Additional Comments</h4>
            <textarea
              value={designComments}
              onChange={(e) => onCommentsChange(e.target.value)}
              placeholder="Add any specific requirements or notes..."
              className="w-full px-3 py-2 border rounded-lg text-gray-800 h-24 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 