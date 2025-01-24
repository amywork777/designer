'use client';

import { useState } from 'react';
import { Package, Info } from 'lucide-react';

interface Process {
  name: string;
  unit: string;
  minSize: number;
  maxSize: number;
  materials: string[];
}

interface ManufacturingRecommendationsProps {
  selectedProcess: Process;
  setSelectedProcess: (process: Process) => void;
  dimensions: { size: string; unit: string };
}

const MANUFACTURING_PROCESSES: Process[] = [
  {
    name: '3D Printing',
    unit: 'inches',
    minSize: 0.1,
    maxSize: 12,
    materials: ['PLA', 'PETG', 'ABS']
  },
  {
    name: 'CNC Machining',
    unit: 'inches',
    minSize: 0.5,
    maxSize: 24,
    materials: ['Aluminum', 'Steel', 'Plastic']
  },
  {
    name: 'Injection Molding',
    unit: 'inches',
    minSize: 1,
    maxSize: 36,
    materials: ['ABS', 'PP', 'PE']
  }
];

export function ManufacturingRecommendations({
  selectedProcess,
  setSelectedProcess,
  dimensions
}: ManufacturingRecommendationsProps) {
  const [selectedMaterial, setSelectedMaterial] = useState(selectedProcess.materials[0]);

  // Filter processes based on dimensions
  const compatibleProcesses = MANUFACTURING_PROCESSES.filter(process => {
    const size = parseFloat(dimensions.size || '0');
    return size >= process.minSize && size <= process.maxSize;
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
          {compatibleProcesses.map((process, index) => (
            <div key={index} className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-lg font-bold text-gray-700 mb-2">
                {process.name}
              </h4>
              <p className="text-gray-600 mb-3">{process.name} process</p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Lead Time</p>
                  <p className="text-gray-700">{process.name} lead time</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Accuracy</p>
                  <p className="text-gray-700">{process.name} accuracy</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Surface Finish</p>
                <p className="text-gray-700">{process.name} surface finish</p>
              </div>

              <div className="mb-4 space-y-2">
                <p className="text-sm font-medium text-gray-500">Ratings</p>
                {renderRating(5, 'Strength')}
                {renderRating(5, 'Detail')}
                {renderRating(5, 'Cost-effectiveness')}
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Key Advantages</p>
                <ul className="list-disc list-inside text-gray-700">
                  {process.name === '3D Printing' ? [
                    'Most cost-effective option',
                    'Wide range of materials',
                    'Easy to post-process',
                    'Good structural properties',
                    'Fast turnaround time'
                  ].map((item, i) => (
                    <li key={i}>{item}</li>
                  )) : []}
                </ul>
              </div>

              <div className="mb-4">
                <p className="text-sm font-medium text-gray-500 mb-2">Available Materials</p>
                <div className="flex flex-wrap gap-2">
                  {process.materials.map((material, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                      {material}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedProcess(process);
                  setSelectedMaterial(process.materials[0]);
                }}
                className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Select {process.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Material Selection */}
      <div>
        <h4 className="font-medium mb-2">Material</h4>
        <select
          value={selectedMaterial}
          onChange={(e) => setSelectedMaterial(e.target.value)}
          className="w-full p-3 border border-gray-200 rounded-xl"
        >
          {selectedProcess.materials.map((material) => (
            <option key={material} value={material}>
              {material}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
} 