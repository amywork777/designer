'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ManufacturingAnalysis } from '@/components/ManufacturingAnalysis';
import { Package, Lock, Check, Sparkles, Download } from 'lucide-react';
import { useDesignStore } from '@/lib/store/designs';
import { useToast } from "@/components/ui/use-toast";
import { getMaterialRecommendation } from '@/lib/utils/materials';
import Link from 'next/link';

const MATERIAL_OPTIONS = [
  {
    title: "PLA",
    description: "Basic plastic filament, easy to print, most common and cost-effective.",
    cost: "$ (Most Affordable)"
  },
  {
    title: "Wood PLA",
    description: "Regular PLA mixed with wood particles for natural look.",
    cost: "$$ (Mid-Range)"
  },
  {
    title: "TPU",
    description: "Flexible, squishy rubber-like material that can bend.",
    cost: "$$ (Mid-Range)"
  },
  {
    title: "Resin",
    description: "Liquid that cures into solid, gives smoothest finish, provides high detail.",
    cost: "$$$ (Premium)"
  },
  {
    title: "Aluminum",
    description: "High-quality metal that provides an elegant look.",
    cost: "$$$$ (Premium)"
  }
];

const PRICING = {
  Mini: { PLA: 20, Wood: 40, TPU: 45, Resin: 60, Aluminum: 200 },
  Small: { PLA: 35, Wood: 55, TPU: 60, Resin: 80, Aluminum: 'contact us' },
  Medium: { PLA: 60, Wood: 125, TPU: 150, Resin: 200, Aluminum: 'contact us' },
  Large: { PLA: 'contact us', Wood: 'contact us', TPU: 'contact us', Resin: 'contact us', Aluminum: 'contact us' }
} as const;

const DELIVERY_ESTIMATES = {
  Mini: { PLA: '< 2 weeks', Wood: '< 2 weeks', TPU: '< 2 weeks', Resin: '< 2 weeks' },
  Small: { PLA: '< 2 weeks', Wood: '< 3 weeks', TPU: '< 3 weeks', Resin: '< 2 weeks' },
  Medium: { PLA: '< 2 weeks', Wood: '< 3 weeks', TPU: '< 3 weeks', Resin: '< 2 weeks' },
  Large: { PLA: '< 1 month', Wood: '< 1 month', TPU: '< 3 weeks', Resin: '< 2 weeks' }
} as const;

const getPriceAndDelivery = (size: string, material: string) => {
  const materialKey = material.replace(' PLA', '') as keyof typeof PRICING.Mini;
  const sizeKey = size as keyof typeof PRICING;
  
  const price = PRICING[sizeKey]?.[materialKey];
  const delivery = DELIVERY_ESTIMATES[sizeKey]?.[materialKey];
  
  return { price, delivery };
};

export default function GetItMade() {
  const searchParams = useSearchParams();
  const designId = searchParams.get('designId');
  const { designs, loadDesign } = useDesignStore();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDesignFinalized, setIsDesignFinalized] = useState(false);
  const [dimensions, setDimensions] = useState({ length: 0, width: 0, height: 0, unit: 'mm' });
  const [quantity, setQuantity] = useState(1);
  const [designComments, setDesignComments] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [recommendationInfo, setRecommendationInfo] = useState<{ material: string; reason: string } | null>(null);
  const [processing3D, setProcessing3D] = useState(false);
  const MAX_RETRIES = 3;

  // Load design data when the page loads
  useEffect(() => {
    async function fetchDesign() {
      if (designId) {
        setIsLoading(true);
        try {
          await loadDesign(designId);
        } catch (error) {
          console.error('Error loading design:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load design"
          });
        } finally {
          setIsLoading(false);
        }
      }
    }
    fetchDesign();
  }, [designId]);

  const design = designs.find(d => d.id === designId);
  const selectedDesign = design?.images[0];

  // Reference the finalize design handler from page.tsx
  const handleFinalizeDesign = async () => {
    if (!design?.images[0]) return;

    setIsDesignFinalized(true);
    
    toast({
      title: "Analyzing Design",
      description: "Generating material recommendation...",
      duration: 3000
    });

    try {
      const { recommendedMaterial, reason } = await getMaterialRecommendation(design.images[0]);
      
      if (!recommendedMaterial || !reason) {
        throw new Error('Invalid recommendation received');
      }

      setSelectedMaterial(recommendedMaterial);
      setRecommendationInfo({ material: recommendedMaterial, reason });

      updateDesign(design.id, {
        analysis: {
          ...design.analysis,
          recommendedMaterial,
          reason,
          isFinalized: true,
          dimensions,
          quantity,
          comments: designComments,
          lastUpdated: new Date().toISOString()
        }
      });

      toast({
        title: "Success",
        description: `Recommended Material: ${recommendedMaterial}`,
        duration: 5000
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate material recommendation"
      });
    }
  };

  useEffect(() => {
    async function handle3DProcessing() {
      if (!design?.images[0]) return;
      
      setProcessing3D(true);
      let attempts = 0;
      
      while (attempts < MAX_RETRIES) {
        try {
          const response = await fetch('https://us-central1-taiyaki-test1.cloudfunctions.net/process_3d', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              image_url: design.images[0],
              userId: 'anonymous'
            })
          });

          // Get the raw response text first for debugging
          const rawText = await response.text();
          console.log('Raw response:', rawText);

          let data;
          try {
            data = JSON.parse(rawText);
          } catch (e) {
            console.error('Failed to parse response:', e);
            throw new Error('Invalid response from server');
          }

          if (!response.ok) {
            throw new Error(data.error || 'Server error');
          }

          if (data.success && data.video_url) {
            updateDesign(design.id, {
              threeDData: {
                videoUrl: data.video_url,
                glbUrls: data.glb_urls || [],
                preprocessedUrl: data.preprocessed_url,
                timestamp: data.timestamp
              }
            });

            toast({
              title: "Success",
              description: "3D model generated successfully"
            });
            return; // Success - exit the retry loop
          }
          
        } catch (error) {
          console.error('Attempt failed:', error);
          attempts++;
          if (attempts === MAX_RETRIES) {
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to generate 3D model"
            });
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        } finally {
          setProcessing3D(false);
        }
      }
    }

    handle3DProcessing();
  }, [design?.images[0]]);

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto text-gray-400 animate-pulse mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Loading Design...</h1>
        </div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Design Found</h1>
          <p className="text-gray-600">The design you're looking for could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Design Preview */}
        <div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Design</h2>
            <div className="aspect-square relative rounded-lg overflow-hidden mb-4">
              <img
                src={design.images[0]}
                alt="Design Preview"
                className="object-contain w-full h-full"
              />
            </div>
            
            {/* Debug log */}
            {console.log('Design 3D Data:', design?.threeDData)}
            
            {/* 3D Preview */}
            {design?.threeDData?.videoUrl && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">3D Preview</h4>
                <video 
                  width="100%" 
                  height="auto" 
                  controls 
                  className="rounded-lg"
                  key={design.threeDData.videoUrl}
                >
                  <source 
                    src={design.threeDData.videoUrl} 
                    type="video/mp4" 
                  />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Manufacturing Options */}
        <div>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="space-y-6">
              {/* Manufacturing Analysis Component */}
              <ManufacturingAnalysis
                imageUrl={design.images[0]}
                existingAnalysis={design.analysis}
                onAnalysisComplete={(analysis) => {
                  updateDesign(design.id, { analysis });
                }}
                quantity={quantity}
                onQuantityChange={setQuantity}
                dimensions={dimensions}
                onDimensionsChange={setDimensions}
                designComments={designComments}
                onCommentsChange={setDesignComments}
              />

              {/* Material Selection Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-semibold text-gray-800">
                    Select Material
                    {dimensions.size && (
                      <span className="ml-2 text-sm font-normal text-gray-800">
                        • Size: {dimensions.size}
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={handleFinalizeDesign}
                    className="inline-flex items-center px-4 py-2 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    What material should I choose?
                  </button>
                </div>

                {/* Show recommendation if available */}
                {recommendationInfo && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Recommended Material: {recommendationInfo.material}</h4>
                    <p className="text-blue-800 text-sm">{recommendationInfo.reason}</p>
                  </div>
                )}

                {/* Material Options */}
                <div className="space-y-3">
                  {MATERIAL_OPTIONS.map((material) => {
                    const materialPrice = dimensions.size ? 
                      PRICING[dimensions.size as keyof typeof PRICING]?.[material.title.replace(' PLA', '') as keyof typeof PRICING.Mini] 
                      : null;

                    return (
                      <div
                        key={material.title}
                        className={`p-4 rounded-lg border transition-all ${
                          selectedMaterial === material.title
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                        onClick={() => setSelectedMaterial(material.title)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{material.title}</h4>
                            <p className="text-sm text-gray-600">{material.description}</p>
                          </div>
                          <div className="ml-4 pl-4 border-l">
                            {dimensions.size ? (
                              <div className="text-right">
                                <p className={`text-lg font-bold ${
                                  typeof materialPrice === 'number' 
                                    ? 'text-blue-600' 
                                    : 'text-gray-600'
                                }`}>
                                  {typeof materialPrice === 'number' 
                                    ? `$${materialPrice}`
                                    : materialPrice === 'contact us' 
                                      ? 'Contact for Quote'
                                      : material.cost}
                                </p>
                              </div>
                            ) : (
                              <p className="text-gray-600 font-medium">
                                {material.cost}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Price and Delivery Estimate */}
                {dimensions.size && selectedMaterial && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Order Summary</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Price:</span>
                        <span className="font-medium text-gray-900">
                          {typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number'
                            ? `$${getPriceAndDelivery(dimensions.size, selectedMaterial).price}`
                            : 'Contact us for quote'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Estimated Delivery:</span>
                        <span className="font-medium text-gray-900">
                          {getPriceAndDelivery(dimensions.size, selectedMaterial).delivery || 'Contact us'}
                        </span>
                      </div>
                      {quantity > 1 && typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number' && (
                        <div className="flex justify-between items-center text-blue-600">
                          <span>Bulk Discount (10% off):</span>
                          <span>-${(Number(getPriceAndDelivery(dimensions.size, selectedMaterial).price) * quantity * 0.1).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between items-center font-semibold text-lg">
                          <span>Total:</span>
                          <span>
                            {typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number'
                              ? `$${(Number(getPriceAndDelivery(dimensions.size, selectedMaterial).price) * quantity * (quantity > 1 ? 0.9 : 1)).toFixed(2)}`
                              : 'Contact us for quote'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Proceed Button */}
              <button
                onClick={handleFinalizeDesign}
                disabled={!selectedMaterial}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 
                  text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Package className="w-5 h-5" />
                {typeof getPriceAndDelivery(dimensions.size || '', selectedMaterial)?.price === 'number'
                  ? 'Proceed to Checkout'
                  : 'Request Quote'}
              </button>

              <Link 
                href={`/get-files?designId=${designId}`}
                className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Get Files
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 