import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Add type for manufacturing method
type ManufacturingMethod = typeof MANUFACTURING_METHODS[number];

interface MethodSelectorProps {
  selectedMethod: string | null;
  onMethodSelect: (method: string) => void;
  onMaterialSelect: (material: string) => void;
  manufacturingOptions: readonly ManufacturingMethod[];
}

export function ManufacturingMethodSelector({
  selectedMethod,
  onMethodSelect,
  onMaterialSelect,
  manufacturingOptions
}: MethodSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleMethodSelect = (methodName: string) => {
    onMethodSelect(methodName);
    // Find the method and auto-select its first material
    const method = manufacturingOptions.find(m => m.name === methodName);
    if (method && method.materials.length > 0) {
      onMaterialSelect(method.materials[0]);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-4 bg-gray-50 
          rounded-lg hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium">Manufacturing Method</span>
          {selectedMethod && (
            <span className="text-gray-600">: {selectedMethod}</span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5" />
        ) : (
          <ChevronRight className="w-5 h-5" />
        )}
      </button>

      {isExpanded && manufacturingOptions && manufacturingOptions.length > 0 && (
        <div className="space-y-4 p-4 border rounded-lg">
          {manufacturingOptions.map((method) => (
            <div
              key={method.name}
              className={`p-4 border rounded-lg cursor-pointer transition-all
                ${selectedMethod === method.name 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'hover:border-blue-300'}`}
              onClick={() => handleMethodSelect(method.name)}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{method.name}</h4>
                {selectedMethod === method.name && (
                  <span className="text-blue-600 text-sm">Selected</span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Volume Range:</span>{' '}
                  <span>{method.volumeRange}</span>
                </div>
                <div>
                  <span className="font-medium">Materials:</span>
                  <div className="mt-1 space-x-2">
                    {method.materials.map((material) => (
                      <button
                        key={material}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMaterialSelect(material);
                        }}
                        className={`px-2 py-1 rounded-full text-xs
                          ${selectedMethod === method.name
                            ? 'bg-blue-200 hover:bg-blue-300'
                            : 'bg-gray-200 hover:bg-gray-300'}`}
                      >
                        {material}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-600">{method.bestFor}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 