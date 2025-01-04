'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Download, Cog, Clock, Check } from 'lucide-react';
import Link from 'next/link';
import { useDesignStore } from '@/lib/store/designs';
import { ManufacturingAnalysis } from '@/components/ManufacturingAnalysis';

export default function SelectDesign() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const imagesParam = searchParams.get('images');
  const promptParam = searchParams.get('prompt');
  
  const { designs, addDesign, updateDesign } = useDesignStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentDesign, setCurrentDesign] = useState<string | null>(null);
  
  const currentImages = imagesParam ? JSON.parse(decodeURIComponent(imagesParam)) : [];

  const handleDownload = async (imageUrl: string) => {
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error('Failed to download image');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-design.png';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50">
      <div className="container mx-auto px-4 py-6">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-8"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Generator
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Current and Previous Designs */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Designs</h2>
            
            {/* Current Generation */}
            {currentImages.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Current Generation
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {currentImages.map((imageUrl: string, index: number) => (
                    <motion.div
                      key={`current-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group ${
                        selectedImage === imageUrl ? 'ring-4 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedImage(imageUrl)}
                    >
                      <img
                        src={imageUrl}
                        alt={`Generated design ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(imageUrl);
                          }}
                          className="p-2 bg-white rounded-full hover:bg-gray-100"
                        >
                          <Download className="w-6 h-6" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Designs */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-700">Previous Designs</h3>
              {designs.map((design) => (
                <div key={design.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {design.images.slice(0, 4).map((imageUrl, index) => (
                      <div
                        key={index}
                        className="aspect-square rounded-lg overflow-hidden cursor-pointer"
                        onClick={() => {
                          setSelectedImage(imageUrl);
                          setCurrentDesign(design.id);
                        }}
                      >
                        <img
                          src={`/api/proxy-image?url=${encodeURIComponent(imageUrl)}`}
                          alt={`Design ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {new Date(design.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Manufacturing Analysis Panel */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            {selectedImage ? (
              <ManufacturingAnalysis
                imageUrl={selectedImage}
                onAnalysisComplete={(analysis) => {
                  if (currentDesign) {
                    updateDesign(currentDesign, { analysis });
                  }
                }}
              />
            ) : (
              <div className="text-center text-gray-500">
                Select a design to analyze manufacturing feasibility
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 