'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { ManufacturingAnalysis } from '@/components/ManufacturingAnalysis';
import { Package, Lock, Check, Sparkles, Download, Info as InfoIcon, DollarSign, ArrowRight, Loader2, FileDown, ChevronDown, ChevronRight, X, Upload, ArrowLeft } from 'lucide-react';
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
import { canDownloadFile, recordDownload, getUserSubscription } from '@/lib/firebase/subscriptions';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { PLAN_LIMITS } from '@/types/subscription';
import { getUserDesigns } from '@/lib/firebase/designs';

const PRICING = {
  Mini: { PLA: 20, Wood: 40, TPU: 45, Resin: 60, Aluminum: 200 },
  Small: { PLA: 35, Wood: 55, TPU: 60, Resin: 80, Aluminum: 'contact us' },
  Medium: { PLA: 60, Wood: 125, TPU: 150, Resin: 200, Aluminum: 'contact us' },
  Large: { PLA: 'contact us', Wood: 'contact us', TPU: 'contact us', Resin: 'contact us', Aluminum: 'contact us' }
} as const;

type SizeType = keyof typeof SIZE_OPTIONS;

const MATERIALS = ['PLA', 'Wood-PLA', 'TPU', 'Resin', 'Aluminum'];

const MATERIAL_DESCRIPTIONS = {
  'PLA': 'Basic plastic filament, easy to print, most common and cost-effective.',
  'Wood-PLA': 'Regular PLA mixed with wood particles for natural look.',
  'TPU': 'Flexible, squishy rubber-like material.',
  'Resin': 'Liquid that cures into solid. High detail but requires special handling.',
  'Aluminum': 'High-quality metal requiring advanced manufacturing processes.'
};

const DELIVERY_ESTIMATES = {
  Mini: { PLA: '< 2 weeks', Wood: '< 2 weeks', TPU: '< 2 weeks', Resin: '< 2 weeks' },
  Small: { PLA: '< 2 weeks', Wood: '< 3 weeks', TPU: '< 3 weeks', Resin: '< 2 weeks' },
  Medium: { PLA: '< 2 weeks', Wood: '< 3 weeks', TPU: '< 3 weeks', Resin: '< 2 weeks' },
  Large: { PLA: '< 1 month', Wood: '< 1 month', TPU: '< 3 weeks', Resin: '< 2 weeks' }
} as const;

const SIZE_OPTIONS_LIST: SizeOption[] = [
  {
    name: 'Mini',
    dimensions: 'Up to 2 x 2 x 2"'
  },
  {
    name: 'Small',
    dimensions: 'Up to 3.5 x 3.5 x 3.5"'
  },
  {
    name: 'Medium',
    dimensions: 'Up to 5 x 5 x 5"'
  },
  {
    name: 'Large',
    dimensions: 'Up to 10 x 10 x 10"'
  }
];

// Manufacturing types grouped
const MANUFACTURING_GROUPS = {
  '3D_PRINTING': {
    title: '3D Printing',
    description: 'Fast prototyping and small production runs',
    options: {
      'PLA': 'Standard PLA',
      'WOOD_PLA': 'Wood PLA',
      'TPU': 'Flexible TPU',
      'RESIN': 'High Detail Resin',
      'ALUMINUM': 'Metal Aluminum'
    }
  },
  'ADVANCED': {
    title: 'Advanced Manufacturing',
    description: 'Industrial-grade production methods',
    options: {
      'CNC': 'CNC Machining',
      'INJECTION': 'Injection Molding',
      'SHEET_METAL': 'Sheet Metal'
    }
  }
} as const;

type ManufacturingType = keyof (typeof MANUFACTURING_GROUPS['3D_PRINTING']['options'] & 
                              typeof MANUFACTURING_GROUPS['ADVANCED']['options']);

// Add this type definition
type PricingType = {
  price: string;
};

export default function GetItMade() {
  const { designs, updateDesign } = useDesignStore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const designId = searchParams.get('designId');
  const router = useRouter();
  const { data: session } = useSession();
  
  const [isDesignFinalized, setIsDesignFinalized] = useState(false);
  const [selectedType, setSelectedType] = useState<ManufacturingType>('PLA');
  const [expandedGroup, setExpandedGroup] = useState<'3D_PRINTING' | 'ADVANCED' | null>('3D_PRINTING');
  const [selectedSize, setSelectedSize] = useState<SizeType>('Mini');
  const [quantity, setQuantity] = useState(1);
  const [designComments, setDesignComments] = useState('');
  const [processing3D, setProcessing3D] = useState(false);
  const [filesUnlocked, setFilesUnlocked] = useState(false);
  const [show3DPreview, setShow3DPreview] = useState(false);
  const [showSignInPopup, setShowSignInPopup] = useState(false);
  const [pricing, setPricing] = useState<PricingType>({ price: 'Contact us' });
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingSTL, setIsDownloadingSTL] = useState(false);
  const [isDownloadingSTEP, setIsDownloadingSTEP] = useState(false);
  const [downloadLimits, setDownloadLimits] = useState<{ stl: number; step: number } | null>(null);
  const [design, setDesign] = useState<Design | null>(null);

  const selectedDesign = design?.images[0];

  useEffect(() => {
    if (design?.threeDData?.videoUrl) {
      setShow3DPreview(true);
    }
  }, [design?.threeDData?.videoUrl]);

  useEffect(() => {
    if (selectedSize && selectedType) {
      const priceValue = PRICING[selectedSize]?.[selectedType];
      setPricing({ 
        price: typeof priceValue === 'number' ? `$${priceValue}` : 'Contact us'
      });
    }
  }, [selectedSize, selectedType]);

  useEffect(() => {
    // Simple loading effect
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    async function fetchLimits() {
      if (session?.user) {
        const subscription = await getUserSubscription(session.user.id);
        if (subscription) {
          const limits = PLAN_LIMITS[subscription.planType];
          const used = subscription.downloadCounts || { stl: 0, step: 0 };
          setDownloadLimits({
            stl: limits.stlDownloads === Infinity ? Infinity : limits.stlDownloads - used.stl,
            step: limits.stepDownloads === Infinity ? Infinity : limits.stepDownloads - used.step
          });
        }
      }
    }
    fetchLimits();
  }, [session?.user]);

  // Load single design
  useEffect(() => {
    const loadDesign = async () => {
      if (designId && session?.user?.id) {
        const designs = await getUserDesigns(session.user.id);
        const found = designs.find(d => d.id === designId);
        setDesign(found || null);
      }
    };
    loadDesign();
  }, [designId, session?.user?.id]);

  const handleUpdateDesign = async (updates: Partial<Design>) => {
    if (!design?.id) return;
    
    await updateDesign(design.id, updates);
    setDesign(prev => prev ? { ...prev, ...updates } : null);
  };

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
        dimensions: SIZE_OPTIONS[selectedSize],
        manufacturingOptions: [],
        status: 'analyzed' as const,
        features: data.features,
        recommendedMethod: data.recommendedMethod,
        recommendedMaterials: data.recommendedMaterials
      };

      await handleUpdateDesign({
        analysis: updatedAnalysis
      });

      // Set the recommended material
      if (data.recommendedMaterials && data.recommendedMaterials.length > 0) {
        setSelectedType(data.recommendedMaterials[0] as ManufacturingType);
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

    if (!selectedSize || !selectedType) {
      return;
    }

    const isCustomQuote = typeof getPriceAndDelivery().price !== 'number';

    if (isCustomQuote) {
      // Handle custom quote request
      router.push(`/request-quote?designId=${design.id}&size=${selectedSize}&material=${selectedType}&quantity=${quantity}`);
    } else {
      // Handle direct checkout
      try {
        // You can add your checkout logic here
        router.push(`/checkout?designId=${design.id}&size=${selectedSize}&material=${selectedType}&quantity=${quantity}`);
      } catch (error) {
        console.error('Checkout error:', error);
        // Handle error appropriately
      }
    }
  };

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second delay between attempts

  const handle3DProcessing = async () => {
    if (!design) return;
    
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
          await handleUpdateDesign({
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
          return;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        
      } catch (error) {
        console.error(`Attempt ${attempts + 1} failed:`, error);
        if (attempts >= MAX_RETRIES - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  };

  const fetchDownloadLimits = async () => {
    if (session?.user) {
      const subscription = await getUserSubscription(session.user.id);
      if (subscription) {
        const limits = PLAN_LIMITS[subscription.planType];
        const used = subscription.downloadCounts || { stl: 0, step: 0 };
        setDownloadLimits({
          stl: limits.stlDownloads === Infinity ? Infinity : limits.stlDownloads - used.stl,
          step: limits.stepDownloads === Infinity ? Infinity : limits.stepDownloads - used.step
        });
      }
    }
  };

  const handleDownload = async (type: 'stl' | 'step') => {
    if (!session?.user) {
      setShowSignInPopup(true);
      return;
    }

    if (!design?.threeDData?.glbUrls?.[0]) {
      toast({
        title: "Error",
        description: "No 3D model available for download",
        variant: "destructive",
      });
      return;
    }

    try {
      const { allowed, remaining } = await canDownloadFile(session.user.id, type);
      
      if (!allowed) {
        toast({
          title: "Download limit reached",
          description: `You've reached your ${type.toUpperCase()} download limit for this month.`,
          variant: "destructive"
        });
        return;
      }

      if (type === 'stl') {
        setIsDownloadingSTL(true);
      } else {
        setIsDownloadingSTEP(true);
      }

      const response = await fetch('/api/convert-glb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          glbUrl: design.threeDData.glbUrls[0],
          designId: design.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to convert file');
      }

      const blob = await response.blob();

      await recordDownload(session.user.id, design.id, type);
      
      await fetchDownloadLimits();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${design.id}.${type}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `${type.toUpperCase()} file downloaded successfully${
          remaining === Infinity ? '' : `. ${remaining - 1} downloads remaining this month`
        }`
      });

    } catch (error: any) {
      console.error(`Error downloading ${type}:`, error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    } finally {
      if (type === 'stl') {
        setIsDownloadingSTL(false);
      } else {
        setIsDownloadingSTEP(false);
      }
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

  const is3DPrinting = useCallback(() => {
    return ['PLA', 'WOOD_PLA', 'TPU', 'RESIN', 'ALUMINUM'].includes(selectedType);
  }, [selectedType]);

  const getPriceAndDelivery = useCallback(() => {
    if (!is3DPrinting()) {
      return {
        price: 'Contact',
        delivery: 'Variable'
      };
    }

    // Convert selected type to material name for pricing lookup
    const materialMap = {
      'PLA': 'PLA',
      'WOOD_PLA': 'Wood-PLA',
      'TPU': 'TPU',
      'RESIN': 'Resin',
      'ALUMINUM': 'Aluminum'
    };

    const material = materialMap[selectedType as keyof typeof materialMap];
    const pricing = PRICING[selectedSize]?.[material];
    
    return pricing || {
      price: '(Select options)',
      delivery: '(Select options)'
    };
  }, [selectedType, selectedSize, is3DPrinting]);

  const calculateTotal = () => {
    // Add a check for pricing
    if (!pricing || !pricing.price) {
      return 'Contact us';
    }
    
    // Check if it's a "contact us" price
    if (pricing.price === 'contact us' || typeof pricing.price !== 'string') {
      return 'Contact us';
    }
    
    const basePrice = Number(pricing.price.replace('$', ''));
    if (isNaN(basePrice)) return 'N/A';
    
    return `$${(basePrice * quantity).toFixed(2)}`;
  };

  const getButtonText = useCallback(() => {
    const pricing = getPriceAndDelivery();
    
    // If price is Contact or total is N/A, show quote button
    if (pricing.price === 'Contact' || calculateTotal() === 'N/A') {
      return 'Submit for a Quote';
    }

    // If any required selections are missing, show complete selections
    if (!selectedSize || !selectedType || pricing.price === '(Select options)') {
      return 'Complete Selections Above';
    }

    // If we have a valid price, show checkout button
    return 'Proceed to Checkout';
  }, [getPriceAndDelivery, selectedSize, selectedType, calculateTotal]);

  // Debug log to track state changes
  useEffect(() => {
    console.log('State:', {
      selectedType,
      is3DPrinting: is3DPrinting(),
      pricing: getPriceAndDelivery()
    });
  }, [selectedType, is3DPrinting, getPriceAndDelivery]);

  // Debugging log
  console.log('Current selections:', { selectedType, selectedSize });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!designId || !design) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            asChild
          >
            <Link href="/">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-4">Get It Made</h1>
        <p className="text-gray-600 mb-8">Upload your design or create one to get started</p>
        
        <div className="bg-white rounded-2xl p-12 text-center">
          <div className="mb-6">
            <Image
              src="/taiyaki-logo.svg"
              alt="Taiyaki Logo"
              width={60}
              height={60}
              className="mx-auto"
            />
          </div>
          <h2 className="text-2xl font-bold mb-4">Ready to make your design?</h2>
          <p className="text-gray-600 mb-8">
            Upload your design file or create a new one to get started with manufacturing
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="default" asChild>
              <Link href="/create">Create Design</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/upload">Upload Design</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-rose-100">
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <Button
          variant="ghost"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          asChild
        >
          <Link href="/">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </Button>
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-2 pb-6">
        <h1 className="text-2xl font-dm-sans font-medium text-gray-900 pb-6">
          Ready to bring your design to life? Let's make it happen.
        </h1>

        {/* Manufacturing Section */}
        <div className="mb-12">
          <h3 className="text-base font-medium text-gray-900 mb-4">Manufacturing</h3>
          
          <div className="space-y-4">
            {/* 3D Printing Group */}
            <div className="border rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setExpandedGroup(expandedGroup === '3D_PRINTING' ? null : '3D_PRINTING')}
                className="w-full p-6 bg-white flex justify-between items-center hover:bg-gray-50"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 1.5rem center',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                <div>
                  <div className="font-medium text-left text-lg">{MANUFACTURING_GROUPS['3D_PRINTING'].title}</div>
                  <div className="text-sm text-gray-600 text-left">
                    {MANUFACTURING_GROUPS['3D_PRINTING'].description}
                  </div>
                </div>
              </button>
              
              {expandedGroup === '3D_PRINTING' && (
                <div className="border-t p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(MANUFACTURING_GROUPS['3D_PRINTING'].options).map(([type, label]) => (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type as ManufacturingType)}
                        className={`p-4 rounded-xl border transition-colors
                          ${selectedType === type 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-blue-200'}`}
                      >
                        <div className="text-left">
                          <div className="font-medium mb-1">{label}</div>
                          <div className="text-sm text-gray-600">
                            {type === 'PLA' && 'Most cost-effective option'}
                            {type === 'WOOD_PLA' && 'Natural wood-like appearance'}
                            {type === 'TPU' && 'Flexible and durable'}
                            {type === 'RESIN' && 'Smooth finish and fine detail'}
                            {type === 'ALUMINUM' && 'Strong and metallic'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Manufacturing Group */}
            <div className="border rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => setExpandedGroup(expandedGroup === 'ADVANCED' ? null : 'ADVANCED')}
                className="w-full p-6 bg-white flex justify-between items-center hover:bg-gray-50"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 1.5rem center',
                  backgroundSize: '1.5em 1.5em'
                }}
              >
                <div>
                  <div className="font-medium text-left text-lg">{MANUFACTURING_GROUPS['ADVANCED'].title}</div>
                  <div className="text-sm text-gray-600 text-left">
                    {MANUFACTURING_GROUPS['ADVANCED'].description}
                  </div>
                </div>
              </button>
              
              {expandedGroup === 'ADVANCED' && (
                <div className="border-t p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(MANUFACTURING_GROUPS['ADVANCED'].options).map(([type, label]) => (
                      <button
                        key={type}
                        onClick={() => setSelectedType(type as ManufacturingType)}
                        className={`p-4 rounded-xl border transition-colors
                          ${selectedType === type 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-blue-200'}`}
                      >
                        <div className="text-left">
                          <div className="font-medium mb-1">{label}</div>
                          <div className="text-sm text-gray-600">
                            {type === 'CNC' && 'Precision-cut from solid material blocks'}
                            {type === 'INJECTION' && 'High-volume plastic production'}
                            {type === 'SHEET_METAL' && 'Formed and bent metal parts'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Design Preview and Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="h-full">
            {/* Design Preview Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 h-full">
              <h3 className="text-base font-medium text-gray-900 mb-4">Design Preview</h3>
              <div className="space-y-4">
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
                      <div className="text-center space-y-4">
                        <h3 className="text-center text-[20px] text-gray-700">
                          Get STL for 3D printing and STEP for CAD editing
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <Button 
                              variant="outline" 
                              className="w-full font-dm-sans font-medium text-sm rounded-[10px]" 
                              onClick={() => handleDownload('stl')}
                              disabled={!design?.threeDData?.videoUrl || isDownloadingSTL}
                            >
                              {isDownloadingSTL ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Converting STL...
                                </>
                              ) : (
                                <>
                                  <FileDown className="mr-2 h-4 w-4" />
                                  Download STL File
                                </>
                              )}
                            </Button>
                            {session?.user && downloadLimits && (
                              <div className="text-sm text-center text-gray-600 mt-2">
                                {downloadLimits.stl === Infinity ? 
                                  'Unlimited downloads available' : 
                                  `${downloadLimits.stl}/${PLAN_LIMITS[session?.user.planType || 'free'].stlDownloads} downloads remaining this month`
                                }
                              </div>
                            )}
                          </div>

                          <div>
                            <Button 
                              variant="outline" 
                              className="w-full font-dm-sans font-medium text-sm rounded-[10px]" 
                              onClick={() => handleDownload('step')}
                              disabled={!design?.threeDData?.videoUrl || isDownloadingSTEP}
                            >
                              {isDownloadingSTEP ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Converting STEP...
                                </>
                              ) : (
                                <>
                                  <FileDown className="mr-2 h-4 w-4" />
                                  Download STEP File
                                </>
                              )}
                            </Button>
                            {session?.user && downloadLimits && (
                              <div className="text-sm text-center text-gray-600 mt-2">
                                {downloadLimits.step === Infinity ? 
                                  'Unlimited downloads available' : 
                                  `${downloadLimits.step}/${PLAN_LIMITS[session?.user.planType || 'free'].stepDownloads} downloads remaining this month`
                                }
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="h-full flex flex-col">
            {/* Design Details Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 flex-1 relative overflow-hidden flex flex-col">
              {/* Taiyaki Logo Watermark */}
              <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none">
                <Image
                  src="/taiyaki.svg"
                  alt=""
                  width={300}
                  height={300}
                  className="transform translate-x-1/4 translate-y-1/4"
                />
              </div>

              <h3 className="text-base font-medium text-gray-900 mb-4">Design Details</h3>
              <div className="space-y-6 relative z-10 flex-1 flex flex-col">
                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                {/* Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value as SizeType)}
                    className="w-full px-4 py-2.5 border rounded-xl appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 1rem center',
                      backgroundSize: '1.5em 1.5em'
                    }}
                  >
                    <option value="Mini">Mini - Up to 2 x 2 x 2"</option>
                    <option value="Small">Small - Up to 4 x 4 x 4"</option>
                    <option value="Medium">Medium - Up to 8 x 8 x 8"</option>
                    <option value="Large">Large - Up to 12 x 12 x 12"</option>
                    <option value="Custom">Custom Size</option>
                  </select>
                </div>

                {/* Additional Comments */}
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Comments</label>
                  <textarea
                    placeholder="Add any specific requirements or notes..."
                    className="w-full px-4 py-2.5 border rounded-xl resize-none flex-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Price Summary Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Base Price:</span>
                  <span className="font-medium">{is3DPrinting() ? '$15' : 'Contact'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-dm-sans font-medium">
                    {quantity}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Estimated Delivery:</span>
                  <span className="font-dm-sans font-medium">
                    {is3DPrinting() ? '1-2 weeks' : 'Variable'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm font-medium">
                  <span className="text-gray-900">Total:</span>
                  <span className="font-dm-sans font-medium">
                    {calculateTotal()}
                  </span>
                </div>
                <button
                  className={`w-full mt-4 py-3.5 px-4 rounded-xl font-medium flex items-center justify-center space-x-2 transition-all
                    ${getButtonText() === 'Proceed to Checkout' 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0' 
                      : 'bg-black hover:bg-gray-900 text-white'}`}
                  onClick={handleProceed}
                >
                  <span>$</span>
                  <span className={`${getButtonText() === 'Proceed to Checkout' ? 'text-lg' : ''}`}>{getButtonText()}</span>
                  <span className="text-lg">›</span>
                </button>
              </div>
            </div>
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