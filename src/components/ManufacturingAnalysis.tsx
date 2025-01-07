import React, { useState } from 'react';
import { Package, ChevronDown, ChevronUp } from 'lucide-react';

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
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  onDimensionsChange: (dimensions: any) => void;
  isRedoing: boolean;
  designComments: string;
  onCommentsChange: (comments: string) => void;
}

const SIZE_PRESETS = [
  { 
    name: 'Miniature (1-2 inches (25-50mm))', 
    range: { min: 25, max: 50 },
    reference: 'About the size of a golf ball or small action figure'
  },
  { 
    name: 'Desktop (4-8 inches (100-200mm))', 
    range: { min: 100, max: 200 },
    reference: 'About the size of a coffee mug or small vase'
  },
  { 
    name: 'Large Format (10-12 inches (250-300mm))', 
    range: { min: 250, max: 300 },
    reference: 'About the size of a basketball or large decorative bowl'
  },
];

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
  const [selectedPreset, setSelectedPreset] = useState(SIZE_PRESETS[1].name);
  
  const currentPreset = SIZE_PRESETS.find(p => p.name === selectedPreset);
  const currentReference = currentPreset?.reference || '';

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
            <h4 className="font-medium text-gray-900 mb-2">Size & Dimensions</h4>
            
            <select
              value={selectedPreset}
              onChange={(e) => {
                setSelectedPreset(e.target.value);
                onDimensionsChange({
                  ...dimensions,
                  length: 0,
                  width: 0,
                  height: 0
                });
              }}
              className="w-full px-3 py-2 border rounded-lg text-gray-800 bg-white mb-2"
            >
              {SIZE_PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </select>

            <p className="text-sm text-gray-600 mb-2">
              Reference: {currentReference}
            </p>

            <button
              onClick={() => setIsDimensionsExpanded(!isDimensionsExpanded)}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Fine-tune dimensions
              {isDimensionsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isDimensionsExpanded && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Length</label>
                    <input
                      type="number"
                      value={dimensions.length}
                      onChange={(e) => onDimensionsChange({
                        ...dimensions,
                        length: parseInt(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border rounded-lg text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Width</label>
                    <input
                      type="number"
                      value={dimensions.width}
                      onChange={(e) => onDimensionsChange({
                        ...dimensions,
                        width: parseInt(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border rounded-lg text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Height</label>
                    <input
                      type="number"
                      value={dimensions.height}
                      onChange={(e) => onDimensionsChange({
                        ...dimensions,
                        height: parseInt(e.target.value) || 0
                      })}
                      className="w-full px-3 py-2 border rounded-lg text-gray-800"
                    />
                  </div>
                </div>
                <select
                  value={dimensions.unit}
                  onChange={(e) => onDimensionsChange({
                    ...dimensions,
                    unit: e.target.value
                  })}
                  className="w-full px-3 py-2 border rounded-lg text-gray-800"
                >
                  <option value="mm">Millimeters (mm)</option>
                  <option value="inches">Inches</option>
                </select>
              </div>
            )}
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