'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ManufacturingAnalysis } from '@/components/ManufacturingAnalysis';
import { Package, Lock, Check, Sparkles, Download, Info as InfoIcon, DollarSign, ArrowRight, Loader2, FileDown, ChevronDown, ChevronRight, X } from 'lucide-react';
import { useDesignStore } from '@/lib/store/designs';
import { useToast } from "@/components/ui/use-toast";
import { getMaterialRecommendation } from '@/lib/utils/materials';
import Link from 'next/link';
import Show3DButton from '@/components/Show3DButton';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MATERIAL_OPTIONS } from '@/lib/constants/materials';
import SignInPopup from '@/components/SignInPopup';

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
  const basePrice = {
    'Small (up to 5cm)': 20,
    'Medium (5-15cm)': 35,
    'Large (15-25cm)': 50,
    'Extra Large (25cm+)': 75
  }[size] || 0;

  const materialMultiplier = {
    'PLA': 1,
    'PETG': 1.2,
    'ABS': 1.3,
    'TPU': 1.5,
    'Resin': 1.8
  }[material] || 1;

  return {
    price: `$${(basePrice * materialMultiplier).toFixed(2)}`,
    delivery: '3-5 business days'
  };
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
  const [selectedProcess, setSelectedProcess] = useState('3d-printing');
  const [filesUnlocked, setFilesUnlocked] = useState(false);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [showSignInPopup, setShowSignInPopup] = useState(false);

  const design = designs.find(d => d.id === designId);
  const selectedDesign = design?.images[0];

  useEffect(() => {
    if (design?.threeDData?.videoUrl) {
      setShow3DPreview(true);
    }
  }, [design?.threeDData?.videoUrl]);

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
  const RETRY_DELAY = 1000; // 1 second delay between attempts

  const handle3DProcessing = async () => {
    if (!selectedDesign) return;
    
    setProcessing3D(true);
    let attempts = 0;
    
    try {
      while (attempts < MAX_RETRIES) {
        try {
          const response = await fetch('https://us-central1-taiyaki-test1.cloudfunctions.net/process_3d', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              image_url: selectedDesign,
              userId: session?.user?.id || 'default'
            })
          });

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
            const currentDesign = designs.find(d => d.images.includes(selectedDesign));
            if (currentDesign) {
              updateDesign(currentDesign.id, {
                threeDData: {
                  videoUrl: data.video_url,
                  glbUrls: data.glb_urls || [],
                  preprocessedUrl: data.preprocessed_url,
                  timestamp: data.timestamp
                }
              });
            }

            toast({
              title: "Success",
              description: "3D model generated successfully"
            });
            return; // Success - exit the retry loop
          }
          
        } catch (error) {
          console.error(`Attempt ${attempts + 1} failed:`, error);
          attempts++;
          
          if (attempts === MAX_RETRIES) {
            toast({
              variant: "destructive",
              title: "Error",
              description: `Failed after ${MAX_RETRIES} attempts. Please try again later.`
            });
          } else {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        }
      }
    } finally {
      setProcessing3D(false);
    }
  };

  const handleDownload = async (type: 'stl' | 'step') => {
    if (!design?.threeDData?.videoUrl) {
      toast({
        title: "Generate 3D Preview First",
        description: "Please generate a 3D preview before downloading files",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/designs/${design.id}/download?type=${type}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `design.${type}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "There was an error downloading your file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUnlockFiles = () => {
    if (!session) {
      // If user is not signed in, show sign-in popup
      setShowSignInPopup(true);
      return;
    }

    // If user is signed in, proceed with unlocking files
    setFilesUnlocked(true);
    toast({
      title: "Files Unlocked",
      description: "You can now download the files",
    });
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
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-rose-100">
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-6">
        <h1 className="text-2xl font-medium">
          Ready to bring your design to life? Let's make it happen.
        </h1>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="flex gap-6">
          {/* Left Side - Preview and Files */}
          <div className="w-[400px] space-y-6 font-inter">
            <Card className="bg-white rounded-[10px] shadow-sm border">
              <CardHeader>
                <CardTitle className="font-dm-sans font-medium text-lg">Design Preview</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="aspect-square bg-gray-100 rounded-[10px] flex items-center justify-center overflow-hidden">
                  {selectedDesign ? (
                    <img src={selectedDesign} alt="Design preview" className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  )}
                </div>
                {design?.threeDData?.videoUrl ? (
                  <div className="mt-4 space-y-2">
                    <div className="relative w-full rounded-[10px] overflow-hidden shadow-sm">
                      <div className="aspect-video md:aspect-video sm:aspect-square relative">
                        <div className="absolute inset-0 border border-gray-200 rounded-[10px] pointer-events-none z-10" />
                        <video
                          src={design.threeDData.videoUrl}
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                          controls={false}
                          controlsList="nodownload nofullscreen noremoteplayback"
                        />
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 font-inter italic px-1 sm:text-xs md:text-sm">
                      Note: This is an AI-generated preview. The actual 3D model will be professionally optimized for manufacturing with cleaner geometry and proper dimensions.
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handle3DProcessing}
                    disabled={processing3D}
                    className="w-full mt-4 font-dm-sans font-medium text-sm rounded-[10px] bg-black text-white hover:bg-gray-800 
                      disabled:bg-gray-400 flex items-center justify-center gap-2 px-4 py-2 sm:py-3"
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
                  </Button>
                )}

                {/* Download Files Section */}
                <div className="mt-4">
                  <Card className="bg-white rounded-[10px] shadow-sm border">
                    <CardContent className="p-4">
                      <div className="text-center space-y-2">
                        <div className="text-sm text-gray-600">Get STL for 3D printing and STEP for CAD editing</div>
                        {!filesUnlocked ? (
                          <Button 
                            variant="default" 
                            className="w-full bg-black text-white hover:bg-gray-800 font-dm-sans font-medium text-sm rounded-[10px]"
                            onClick={handleUnlockFiles}
                          >
                            <Lock className="mr-2 h-4 w-4" />
                            Unlock Files
                          </Button>
                        ) : (
                          <div className="space-y-2">
                            <Button 
                              variant="outline" 
                              className="w-full font-dm-sans font-medium text-sm rounded-[10px]" 
                              onClick={() => handleDownload('stl')}
                              disabled={!design?.threeDData?.videoUrl}
                            >
                              <FileDown className="mr-2 h-4 w-4" />
                              {!design?.threeDData?.videoUrl ? 'Generate 3D Preview First' : 'Download STL File'}
                            </Button>
                            <Button 
                              variant="outline" 
                              className="w-full font-dm-sans font-medium text-sm rounded-[10px]" 
                              onClick={() => handleDownload('step')}
                              disabled={!design?.threeDData?.videoUrl}
                            >
                              <FileDown className="mr-2 h-4 w-4" />
                              {!design?.threeDData?.videoUrl ? 'Generate 3D Preview First' : 'Download STEP File'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Manufacturing Details */}
          <div className="flex-1 space-y-6 font-inter">
            {/* Manufacturing Analysis Card */}
            <Card className="bg-white rounded-[10px] shadow-sm border">
              <CardHeader>
                <CardTitle className="font-dm-sans font-medium text-lg">Design Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Quantity Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-dm-sans font-medium">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500 font-inter"
                    />
                  </div>

                  {/* Size Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-dm-sans font-medium">Size Selection</label>
                    <select
                      value={dimensions}
                      onChange={(e) => setDimensions(e.target.value)}
                      className="w-full px-3 py-2 border rounded-[10px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-inter appearance-none"
                    >
                      <option value="">Select size...</option>
                      <option value="Small (up to 5cm)">Small (up to 5cm)</option>
                      <option value="Medium (5-15cm)">Medium (5-15cm)</option>
                      <option value="Large (15-25cm)">Large (15-25cm)</option>
                      <option value="Extra Large (25cm+)">Extra Large (25cm+)</option>
                    </select>
                  </div>

                  {/* Additional Comments */}
                  <div className="space-y-2">
                    <label className="text-sm font-dm-sans font-medium">Additional Comments</label>
                    <textarea
                      value={designComments}
                      onChange={(e) => setDesignComments(e.target.value)}
                      placeholder="Add any specific requirements or notes..."
                      rows={4}
                      className="w-full px-3 py-2 border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-blue-500 font-inter resize-none"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Material Selection Card */}
            <Card className="bg-white rounded-[10px] shadow-sm border">
              <CardHeader>
                <CardTitle className="font-dm-sans font-medium text-lg">Select Manufacturing Process</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 3D Printing Section */}
                  <div className="bg-white border rounded-[10px] overflow-hidden shadow-sm">
                    <button
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors rounded-[10px] ${
                        selectedProcess === '3d-printing' ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedProcess(selectedProcess === '3d-printing' ? '' : '3d-printing')}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-dm-sans font-medium text-base">3D Printing</div>
                          <div className="text-sm text-gray-600 font-inter mt-0.5">Layer by layer manufacturing, great for prototypes and small runs</div>
                        </div>
                        <ChevronDown 
                          className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                            selectedProcess === '3d-printing' ? 'transform rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>

                    <div className={`transition-all duration-200 ease-in-out ${
                      selectedProcess === '3d-printing' 
                        ? 'max-h-[1000px] opacity-100' 
                        : 'max-h-0 opacity-0 overflow-hidden'
                    }`}>
                      <div className="divide-y border-t">
                        {MATERIAL_OPTIONS.map((material) => (
                          <button
                            key={material.title}
                            onClick={() => setSelectedMaterial(material.title)}
                            className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                              selectedMaterial === material.title ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-dm-sans font-medium text-base">{material.title}</div>
                                <div className="text-sm text-gray-600 font-inter mt-0.5">{material.description}</div>
                              </div>
                              <div className="text-sm text-gray-600 font-inter whitespace-nowrap">{material.cost}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Advanced Manufacturing Section */}
                  <div className="bg-white border rounded-[10px] overflow-hidden shadow-sm">
                    <button
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors rounded-[10px] ${
                        selectedProcess === 'advanced' ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedProcess(selectedProcess === 'advanced' ? '' : 'advanced')}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-dm-sans font-medium text-base">Advanced Manufacturing</div>
                          <div className="text-sm text-gray-600 font-inter mt-0.5">Industrial manufacturing processes for production runs</div>
                        </div>
                        <ChevronDown 
                          className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                            selectedProcess === 'advanced' ? 'transform rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>

                    <div className={`transition-all duration-200 ease-in-out ${
                      selectedProcess === 'advanced' 
                        ? 'max-h-[1000px] opacity-100' 
                        : 'max-h-0 opacity-0 overflow-hidden'
                    }`}>
                      <div className="divide-y border-t">
                        {[
                          {
                            title: 'CNC Machining',
                            description: 'Precision-cut from solid material blocks',
                            materials: 'Materials: Aluminum, Steel, Plastic',
                            cost: '$$$ (Premium)'
                          },
                          {
                            title: 'Injection Molding',
                            description: 'High-volume plastic production',
                            materials: 'Materials: Various Plastics',
                            cost: '$$$$ (Production)'
                          },
                          {
                            title: 'Sheet Metal',
                            description: 'Formed and bent metal parts',
                            materials: 'Materials: Steel, Aluminum',
                            cost: '$$$ (Premium)'
                          }
                        ].map((process) => (
                          <button
                            key={process.title}
                            onClick={() => setSelectedMaterial(process.title)}
                            className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                              selectedMaterial === process.title ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-dm-sans font-medium text-base">{process.title}</div>
                                <div className="text-sm text-gray-600 font-inter mt-0.5">{process.description}</div>
                                <div className="text-sm text-gray-600 font-inter mt-1">{process.materials}</div>
                              </div>
                              <div className="text-sm text-gray-600 font-inter whitespace-nowrap">{process.cost}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Price Summary Card */}
            <Card className="bg-white rounded-[10px] shadow-sm border">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Price Breakdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 font-inter">Base Price:</span>
                      <span className="font-dm-sans font-medium">
                        {selectedMaterial && dimensions ? getPriceAndDelivery(dimensions.size, selectedMaterial).price : '(Select size and material)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 font-inter">Quantity:</span>
                      <span className="font-dm-sans font-medium">
                        {quantity || 1}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 font-inter">Estimated Delivery:</span>
                      <span className="font-dm-sans font-medium">
                        {selectedMaterial && dimensions ? getPriceAndDelivery(dimensions.size, selectedMaterial).delivery : '(Select size and material)'}
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200"></div>

                  {/* Total */}
                  <div className="flex justify-between items-center">
                    <span className="font-dm-sans font-medium text-base">Total:</span>
                    <span className="font-dm-sans font-medium text-base">
                      {selectedMaterial && dimensions ? 
                        `$${(Number(getPriceAndDelivery(dimensions.size, selectedMaterial).price) * quantity * (quantity > 1 ? 0.9 : 1)).toFixed(2)}` 
                        : '(Complete selections above)'}
                    </span>
                  </div>

                  {/* Action Button */}
                  <Button 
                    variant="default" 
                    className="w-full bg-black text-white hover:bg-gray-800 font-dm-sans font-medium text-sm rounded-[10px] mt-3"
                    disabled={!selectedMaterial || !dimensions}
                    onClick={handleProceed}
                  >
                    <span className="mr-2">$</span>
                    Complete Selections Above
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Add SignInPopup component */}
      <SignInPopup 
        isOpen={showSignInPopup} 
        onClose={() => setShowSignInPopup(false)} 
      />
    </div>
  );
} 