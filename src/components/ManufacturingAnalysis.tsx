import React from 'react';
import { Package, RefreshCw } from 'lucide-react';

interface ManufacturingAnalysisProps {
  imageUrl: string;
  existingAnalysis?: {
    recommendedMaterials?: string[];
    description?: string;
    recommendedMethod?: string;
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

export function ManufacturingAnalysis({
  imageUrl,
  existingAnalysis = {},
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
  const {
    recommendedMaterials = [],
    description = 'No analysis available',
    recommendedMethod = ''
  } = existingAnalysis || {};

  const scaleToLog = (value: number): number => {
    return Math.round(Math.exp(Math.log(10000) * (value / 100)));
  };

  const scaleToLinear = (value: number): number => {
    return Math.round((Math.log(value) / Math.log(10000)) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            Product Analysis
          </h3>
          <button
            onClick={onRedoAnalysis}
            disabled={isRedoing}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white rounded-lg border border-gray-200 
              hover:bg-gray-50 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isRedoing ? 'animate-spin' : ''}`} />
            {isRedoing ? 'Analyzing...' : 'Redo Analysis'}
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Analysis Results</h3>
              <p className="text-gray-700 mt-1">{description}</p>
            </div>
            <button
              onClick={onRedoAnalysis}
              disabled={isRedoing}
              className="text-blue-500 hover:text-blue-600 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${isRedoing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {recommendedMethod && (
            <div>
              <h4 className="font-medium text-gray-900">Recommended Method</h4>
              <p className="text-gray-700">{recommendedMethod}</p>
            </div>
          )}

          {recommendedMaterials?.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900">Recommended Materials</h4>
              <ul className="list-disc list-inside text-gray-700">
                {recommendedMaterials.map((material: string, index: number) => (
                  <li key={index}>{material}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Simple Product Description */}
          <div>
            <p className="text-gray-800">
              {(existingAnalysis?.description || 
                "Simple decorative stand, suitable for 3D printing.")
                .split('.')
                .slice(0, 1)
                .join('.') + '.'}
            </p>
          </div>

          {/* Dimensions Input */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Dimensions</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-600">Length</label>
                <input
                  type="number"
                  value={dimensions.length}
                  onChange={(e) => onDimensionsChange({
                    ...dimensions,
                    length: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-2 py-1 border rounded-lg text-right text-gray-800"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Width</label>
                <input
                  type="number"
                  value={dimensions.width}
                  onChange={(e) => onDimensionsChange({
                    ...dimensions,
                    width: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-2 py-1 border rounded-lg text-right text-gray-800"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Height</label>
                <input
                  type="number"
                  value={dimensions.height}
                  onChange={(e) => onDimensionsChange({
                    ...dimensions,
                    height: parseFloat(e.target.value) || 0
                  })}
                  className="w-full px-2 py-1 border rounded-lg text-right text-gray-800"
                />
              </div>
            </div>
            <select
              value={dimensions.unit}
              onChange={(e) => onDimensionsChange({
                ...dimensions,
                unit: e.target.value as 'mm' | 'inches'
              })}
              className="px-2 py-1 border rounded-lg text-gray-800 text-sm"
            >
              <option value="mm">mm</option>
              <option value="inches">inches</option>
            </select>
          </div>

          {/* Quantity Slider */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">How many do you want?</h4>
            <input
              type="range"
              min="0"
              max="100"
              value={scaleToLinear(quantity)}
              onChange={(e) => onQuantityChange(scaleToLog(parseInt(e.target.value)))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>1-10 pcs</span>
              <span>11-100 pcs</span>
              <span>101+ pcs</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <div className="text-sm text-gray-700">
                {quantity <= 10 ? 'Prototype Run' :
                 quantity <= 100 ? 'Small Batch' :
                 'Production Run'}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => onQuantityChange(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-1 border rounded-lg text-right text-gray-800"
                />
                <span className="text-sm text-gray-600">pcs</span>
              </div>
            </div>
          </div>

          {/* Design Comments */}
          <div className="space-y-2 mt-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium text-gray-700">Design Comments</h4>
              <span className="text-xs text-gray-500">
                {designComments.length}/200 characters
              </span>
            </div>
            <textarea
              value={designComments}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  onCommentsChange(e.target.value);
                }
              }}
              placeholder="Add any specific requirements or modifications needed for your design..."
              className="w-full px-3 py-2 border rounded-lg text-gray-800 min-h-[100px] resize-none"
              maxLength={200}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 