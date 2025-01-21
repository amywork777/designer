'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ManufacturingAnalysis } from '@/components/ManufacturingAnalysis';
import { Package, Lock, Check, Sparkles, Download, Info as InfoIcon, DollarSign, ArrowRight, Loader2 } from 'lucide-react';
import { useDesignStore } from '@/lib/store/designs';
import { useToast } from "@/components/ui/use-toast";
import { getMaterialRecommendation } from '@/lib/utils/materials';
import Link from 'next/link';
import Show3DButton from 'components/Show3DButton';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

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
  const { designs, loadDesign, updateDesign } = useDesignStore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const designId = searchParams.get('designId');
  const router = useRouter();
  const { data: session } = useSession();
  
  const [isDesignFinalized, setIsDesignFinalized] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [recommendationInfo, setRecommendationInfo] = useState<{ material: string; reason: string } | null>(null);
  const [dimensions, setDimensions] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [designComments, setDesignComments] = useState('');
  const [processing3D, setProcessing3D] = useState(false);

  const design = designs.find(d => d.id === designId);
  const selectedDesign = design?.images[0];

  const handleFinalizeDesign = async () => {
    if (!design?.images[0]) return;

    setIsDesignFinalized(true);
    
    toast({
      title: "Analyzing Design",
      description: "Generating material recommendation...",
      duration: 3000
    });

    try {
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: design.images[0]
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze image');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      const updatedAnalysis = {
        productDescription: data.description,
        dimensions: dimensions,
        manufacturingOptions: [],
        status: 'analyzed' as const,
        features: data.features,
        recommendedMethod: data.recommendedMethod,
        recommendedMaterials: data.recommendedMaterials
      };

      updateDesign(design.id, {
        analysis: updatedAnalysis
      });

      // Set the recommended material
      if (data.recommendedMaterials && data.recommendedMaterials.length > 0) {
        setSelectedMaterial(data.recommendedMaterials[0]);
        setRecommendationInfo({
          material: data.recommendedMaterials[0],
          reason: data.description || 'Based on design analysis'
        });
      }

      toast({
        title: "Success",
        description: `Recommended Material: ${data.recommendedMaterials?.[0] || 'PLA'}`,
        duration: 5000
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate material recommendation"
      });
      setIsDesignFinalized(false);
    }
  };

  const handleProceed = async () => {
    if (!session?.user) {
      // Redirect to sign in if not authenticated
      router.push('/auth/signin');
      return;
    }

    if (!dimensions.size || !selectedMaterial) {
      return;
    }

    const isCustomQuote = typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price !== 'number';

    if (isCustomQuote) {
      // Handle custom quote request
      router.push(`/request-quote?designId=${design.id}&size=${dimensions.size}&material=${selectedMaterial}&quantity=${quantity}`);
    } else {
      // Handle direct checkout
      try {
        // You can add your checkout logic here
        router.push(`/checkout?designId=${design.id}&size=${dimensions.size}&material=${selectedMaterial}&quantity=${quantity}`);
      } catch (error) {
        console.error('Checkout error:', error);
        // Handle error appropriately
      }
    }
  };

  const MAX_RETRIES = 3;

  const handle3DProcessing = async () => {
    if (!design?.images[0] || !session?.user?.id) return;
    
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
            userId: session.user.id
          })
        });

        const data = await response.json();

        if (data.success && data.video_url) {
          const threeDData = {
            videoUrl: data.video_url,
            glbUrls: data.glb_urls || [],
            preprocessedUrl: data.preprocessed_url,
            timestamp: data.timestamp
          };

          // Update in Firebase
          await updateDoc(doc(db, 'designs', design.id), {
            threeDData
          });

          // Update local store
          updateDesign(design.id, { threeDData });

          toast({
            title: "Success",
            description: "3D preview generated and saved"
          });
          return;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('3D processing error:', error);
        break;
      }
    }
    setProcessing3D(false);
  };

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
      <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Design</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Design Preview */}
          <div className="aspect-square relative rounded-lg overflow-hidden">
            <img
              src={design.images[0]}
              alt="Design Preview"
              className="object-contain w-full h-full"
            />
          </div>

          {/* 3D Preview if available */}
          {design?.threeDData?.videoUrl && design?.threeDData?.timestamp && !processing3D && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">3D Preview</h4>
              <div className="aspect-video">
                <video 
                  src={design.threeDData.videoUrl}
                  controls
                  className="w-full h-full rounded-lg"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <p className="text-sm text-gray-500 mt-2 italic">
                Note: This is an AI-generated preview. The actual 3D model will be professionally optimized for manufacturing.
              </p>
            </div>
          )}

          {/* Show 3D Generation Button if no video exists */}
          {(!design?.threeDData?.videoUrl || !design?.threeDData?.timestamp) && (
            <div>
              <button
                onClick={handle3DProcessing}
                disabled={processing3D}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 
                  disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {processing3D ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    Generate 3D Preview
                  </>
                )}
              </button>
            </div>
          )}
        </div>


        {/* Creative Guidelines Section */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <InfoIcon className="w-5 h-5 text-blue-500" />
            Creative Guidelines
          </h3>
          
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              • This is great for artistic and decorative items!
            </li>
            <li className="flex items-start gap-2">
              • Best for items where exact measurements aren't crucial
            </li>
            <li className="flex items-start gap-2">
              • Sizes are approximate and may vary slightly
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <button
            onClick={async () => {
              try {
                const response = await fetch('/api/analyze-material', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    imageUrl: design.images[0]
                  }),
                });

                if (!response.ok) {
                  throw new Error('Failed to get recommendation');
                }

                const data = await response.json();
                
                if (data.recommendedMaterial) {
                  setSelectedMaterial(data.recommendedMaterial);
                  setRecommendationInfo({
                    material: data.recommendedMaterial,
                    reason: data.reason
                  });

                  // Save recommendation to design
                  updateDesign(design.id, {
                    recommendedMaterial: data.recommendedMaterial,
                    recommendationReason: data.reason
                  });

                  // Scroll to material section
                  const materialElement = document.getElementById(data.recommendedMaterial);
                  if (materialElement) {
                    materialElement.scrollIntoView({ behavior: 'smooth' });
                    materialElement.classList.add('border-blue-500', 'border-2');
                  }

                  toast({
                    title: "Recommendation Ready",
                    description: `We recommend using ${data.recommendedMaterial}`,
                    duration: 5000
                  });
                }
              } catch (error) {
                console.error('Error:', error);
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: "Failed to get material recommendation"
                });
              }
            }}
            disabled={design.recommendedMaterial !== undefined}
            className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors
              ${design.recommendedMaterial 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {design.recommendedMaterial ? 'Recommendation Made' : 'What material should I choose?'}
          </button>
          <Link 
            href={`/get-files?designId=${design.id}`}
            className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Get Files
          </Link>
        </div>

        {/* Manufacturing Analysis Section */}
        <div className="mt-8">
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
        </div>

        {/* Material Selection Section */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">Select Material</h3>

          {/* Recommendation Info Display */}
          {recommendationInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <Sparkles className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">
                    Recommended: {recommendationInfo.material}
                  </p>
                  <p className="text-gray-600 mt-1">
                    {recommendationInfo.reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {MATERIAL_OPTIONS.map((material) => (
              <div
                key={material.title}
                className={`flex items-center justify-between p-4 bg-white rounded-lg border hover:border-blue-500 cursor-pointer ${
                  selectedMaterial === material.title ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => setSelectedMaterial(material.title)}
              >
                <div>
                  <h4 className="font-medium">{material.title}</h4>
                  <p className="text-sm text-gray-600">{material.description}</p>
                </div>
                <span className="text-gray-500">{material.cost}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Price and Delivery Estimate */}
        <div className="bg-gray-50 rounded-lg p-4 mt-8">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Price Estimate</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Base Price:</span>
              <span className="font-medium text-gray-900">
                {dimensions.size && selectedMaterial 
                  ? (typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number'
                    ? `$${getPriceAndDelivery(dimensions.size, selectedMaterial).price}`
                    : 'Contact us for quote')
                  : '(Select size and material)'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Quantity:</span>
              <span className="font-medium text-gray-900">{quantity || 1}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Estimated Delivery:</span>
              <span className="font-medium text-gray-900">
                {dimensions.size && selectedMaterial
                  ? (getPriceAndDelivery(dimensions.size, selectedMaterial).delivery || 'Contact us')
                  : '(Select size and material)'}
              </span>
            </div>
            {quantity > 1 && dimensions.size && selectedMaterial && typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number' && (
              <div className="flex justify-between items-center text-blue-600">
                <span>Bulk Discount (10% off):</span>
                <span>-${(Number(getPriceAndDelivery(dimensions.size, selectedMaterial).price) * quantity * 0.1).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between items-center font-semibold text-lg mb-4">
                <span>Total:</span>
                <span>
                  {dimensions.size && selectedMaterial
                    ? (typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number'
                      ? `$${(Number(getPriceAndDelivery(dimensions.size, selectedMaterial).price) * quantity * (quantity > 1 ? 0.9 : 1)).toFixed(2)}`
                      : 'Contact us for quote')
                    : '(Complete selections above)'}
                </span>
              </div>
              
              {/* Add Checkout/Quote Button */}
              <button
                onClick={handleProceed}
                disabled={!dimensions.size || !selectedMaterial}
                className={`w-full py-4 rounded-lg transition-all transform hover:scale-[1.02] 
                  shadow-lg hover:shadow-xl flex items-center justify-center gap-3 font-semibold text-lg
                  ${(!dimensions.size || !selectedMaterial)
                    ? 'bg-gray-300 cursor-not-allowed'
                    : typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                      : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white'
                  }`}
              >
                <DollarSign className="w-5 h-5" />
                {!dimensions.size || !selectedMaterial
                  ? 'Complete Selections Above'
                  : typeof getPriceAndDelivery(dimensions.size, selectedMaterial).price === 'number'
                    ? 'Proceed to Checkout'
                    : 'Get Custom Quote'}
                <ArrowRight className="w-5 h-5" />
              </button>
              
              <p className="text-center text-sm text-gray-500 mt-3">
                Secure payment powered by Stripe
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 