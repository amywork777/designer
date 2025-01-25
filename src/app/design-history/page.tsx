'use client';

import { useState, useEffect } from 'react';
import { getUserDesigns } from '@/lib/firebase/firestore';
import { ManufacturingAnalysis } from '@/components/ManufacturingAnalysis';
import { ChevronLeft, Download, Cog, Clock } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function DesignHistory() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const { data: session } = useSession();
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);

  useEffect(() => {
    const loadDesigns = async () => {
      if (session?.user?.id) {
        const userDesigns = await getUserDesigns(session.user.id);
        setDesigns(userDesigns);
      }
    };
    loadDesigns();
  }, [session?.user?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50">
      <div className="container mx-auto px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center text-gray-900 hover:text-blue-600 mb-8"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Generator
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Design History */}
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Design History</h1>
            {designs.map((design) => (
              <div 
                key={design.id} 
                className="bg-white rounded-xl shadow-lg p-4"
              >
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {design.images.map((imageUrl, index) => (
                    <div
                      key={`${design.id}-${index}`}
                      className="aspect-square rounded-lg overflow-hidden cursor-pointer relative group"
                      onClick={() => setSelectedDesign(imageUrl)}
                    >
                      <img
                        src={imageUrl}
                        alt={`Design ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* ... image overlay code ... */}
                    </div>
                  ))}
                </div>
                {/* ... design metadata ... */}
              </div>
            ))}
          </div>

          {/* Manufacturing Analysis Panel */}
          <div className="lg:sticky lg:top-6 self-start">
            <div className="bg-white rounded-xl shadow-lg p-6">
              {selectedDesign ? (
                <ManufacturingAnalysis
                  imageUrl={selectedDesign}
                  onAnalysisComplete={(analysis) => {
                    // Handle analysis completion
                  }}
                />
              ) : (
                <div className="text-center text-gray-900 py-12">
                  <Cog className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Select a design to analyze manufacturing feasibility</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 