'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
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
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
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
import { process3DPreview } from "@/lib/firebase/utils";
import { updateDesign } from "@/lib/firebase/designs";
import { loadStripe } from '@stripe/stripe-js';
import { PRODUCT_PRICING, STEP_FILE_PRICE } from '@/lib/constants/pricing';

const PRICING = {
  Mini: { 
    PLA: 15, 
    'Wood-PLA': 25, 
    TPU: 25, 
    Resin: 35, 
    Aluminum: 120 
  },
  Small: { 
    PLA: 25, 
    'Wood-PLA': 35, 
    TPU: 40, 
    Resin: 60, 
    Aluminum: 'contact' 
  },
  Medium: { 
    PLA: 40, 
    'Wood-PLA': 65, 
    TPU: 85, 
    Resin: 120, 
    Aluminum: 'contact' 
  },
  Large: { 
    PLA: 'contact', 
    'Wood-PLA': 'contact', 
    TPU: 'contact', 
    Resin: 'contact', 
    Aluminum: 'contact' 
  }
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
    label: '3D Printing',
    options: {
      PLA: 'Standard PLA',
      WOOD_PLA: 'Wood PLA',
      TPU: 'Flexible TPU',
      RESIN: 'High Detail Resin',
      ALUMINUM: 'Metal Aluminum'
    }
  },
  'ADVANCED': {
    label: 'Advanced Manufacturing',
    options: {
      CNC: 'CNC Machining',
      INJECTION: 'Injection Molding'
    }
  }
} as const;

type ManufacturingType = keyof (typeof MANUFACTURING_GROUPS['3D_PRINTING']['options'] & 
                              typeof MANUFACTURING_GROUPS['ADVANCED']['options']);

// Add this type definition
type PricingType = {
  price: string;
};

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function GetItMadeContent() {
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
  const [isGenerating, setIsGenerating] = useState(false);
  const paymentStatus = searchParams.get('payment');
  const [showProcessingCard, setShowProcessingCard] = useState(false);
  const [isGLBProcessing, setIsGLBProcessing] = useState(true);

  const design = designs.find(d => d.id === designId);
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

  useEffect(() => {
    if (paymentStatus === 'success') {
      toast({
        title: "Purchase Successful",
        description: "Your STEP file purchase was successful. We'll process and deliver it within 24-48 hours.",
        duration: 5000
      });
    }
  }, [paymentStatus]);

  useEffect(() => {
    if (!design?.id || !session?.user?.id) return;
    
    // Don't set up listener if GLB is already available
    if (design?.threeDData?.glbUrls?.length > 0) {
      setIsGLBProcessing(false);
      return;
    }

    console.log('🎧 Setting up real-time listener for GLB status');
    
    const unsubscribe = onSnapshot(
      doc(db, 'designs', design.id),
      (doc) => {
        const data = doc.data();
        if (data?.threeDData?.glbUrls?.length > 0) {
          console.log('✅ GLB is ready!');
          setIsGLBProcessing(false);
          
          // Update local design state
          updateDesign(design.id, {
            threeDData: data.threeDData
          });
          
          toast({
            title: "3D Model Ready",
            description: "Your model has been fully processed",
            duration: 5000,
          });
        }
      },
      (error) => {
        console.error('Error listening to design updates:', error);
      }
    );

    return () => {
      console.log('🧹 Cleaning up GLB status listener');
      unsubscribe();
    };
  }, [design?.id, session?.user?.id]);

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

      updateDesign(design.id, {
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
      setShowSignInPopup(true);
      return;
    }
  
    try {
      const materialMap = {
        'WOOD_PLA': 'Wood-PLA',
        'PLA': 'PLA',
        'TPU': 'TPU',
        'RESIN': 'Resin',
        'ALUMINUM': 'Aluminum'
      };
  
      const mappedMaterial = materialMap[selectedType];
      const priceValue = PRICING[selectedSize]?.[mappedMaterial];
  
      // Handle quote requests
      if (selectedSize === 'Custom' || selectedSize === 'Large' || !priceValue || priceValue === 'contact') {
        const response = await fetch('/api/send-quote-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            material: selectedType,
            designId: design?.id,
            quantity: quantity,
            size: selectedSize,
            comments: document.querySelector('textarea')?.value || '',
            userEmail: session.user.email
          })
        });
  
        if (!response.ok) {
          throw new Error('Failed to send quote request');
        }
  
        window.location.href = '/quote-confirmation';
        return;
      }
  
      // Fixed price checkout
      const priceIdMap = {
        'Mini': {
          'PLA': { id: 'price_1QmGnoCLoBz9jXRliwBcAA5a', amount: 15 },
          'Wood-PLA': { id: 'price_1QmGo3CLoBz9jXRlsXKVMcKD', amount: 25 },
          'TPU': { id: 'price_1QmGopCLoBz9jXRlZ9Jyt8ZK', amount: 25 },
          'Resin': { id: 'price_1QmGp5CLoBz9jXRlzLV86Psp', amount: 35 },
          'Aluminum': { id: 'price_1QmGpQCLoBz9jXRlqWq1VLPn', amount: 120 }
        },
        'Small': {
          'PLA': { id: 'price_1QmGpfCLoBz9jXRlBcrkWyUj', amount: 25 },
          'Wood-PLA': { id: 'price_1QmGqFCLoBz9jXRlXFN6fM0x', amount: 35 },
          'TPU': { id: 'price_1QmGqTCLoBz9jXRlKqwjXSsK', amount: 40 },
          'Resin': { id: 'price_1QmGqkCLoBz9jXRl4fAPPF3Q', amount: 60 }
        },
        'Medium': {
          'PLA': { id: 'price_1QmGquCLoBz9jXRlh9SG2fqs', amount: 40 },
          'Wood-PLA': { id: 'price_1QmGr6CLoBz9jXRlDM7kHo2H', amount: 65 },
          'TPU': { id: 'price_1QmGrICLoBz9jXRlwC2icqio', amount: 85 },
          'Resin': { id: 'price_1QmGrTCLoBz9jXRl2F14HMZa', amount: 120 }
        }
      };
  
      const priceInfo = priceIdMap[selectedSize]?.[mappedMaterial];
  
      if (!priceInfo) {
        throw new Error('Invalid price configuration');
      }
  
      const response = await fetch('/api/create-3d-printing-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: priceInfo.id,
          amount: priceInfo.amount * quantity,
          quantity,
          metadata: {
            orderType: '3D_MANUFACTURING',
            designId: design?.id,
            material: selectedType,
            size: selectedSize,
            quantity: quantity,
            comments: document.querySelector('textarea')?.value || '',
            userEmail: session.user.email
          },
          shipping_address_collection: {
            allowed_countries: ['US'],
          },
          shipping_options: [{
            shipping_rate: 'shr_1QmGrqCLoBz9jXRlBqFySsDC'
          }]
        })
      });
  
      const data = await response.json();
      if (!data.success || !data.url) {
        throw new Error(data.error || 'Failed to create checkout session');
      }
  
      window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate checkout"
      });
    }
  };
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second delay between attempts

  const handle3DProcessing = async () => {
    if (!design) {
      toast({
        title: "Error",
        description: "Please select a design first",
        variant: "destructive"
      });
      return;
    }

    try {
      setProcessing3D(true);
      setShowProcessingCard(true);
      const userId = session?.user?.id || 'anonymous';
      
      // This will now return as soon as video is ready
      const result = await process3DPreview(design, userId, setProcessing3D);
      
      if (result.success) {
        // Update local state immediately with video data
        updateDesign(design.id, {
          threeDData: {
            videoUrl: result.videoUrl,
            preprocessedUrl: result.preprocessedUrl,
            timestamp: Date.now()
          },
          has3DPreview: true
        });

        toast({
          title: "Success",
          description: "3D preview generated. Full 3D model processing in progress..."
        });
      }
    } catch (error) {
      console.error('Error processing 3D:', error);
      toast({
        title: "Error",
        description: "Failed to generate 3D preview",
        variant: "destructive"
      });
    } finally {
      setProcessing3D(false);
      setShowProcessingCard(false);
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
        variant: "destructive",
        title: "Error",
        description: "No 3D model available for download"
      });
      return;
    }

    if (type === 'stl') {
      try {
        setIsDownloadingSTL(true);
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
          throw new Error(errorData.error || 'Conversion failed');
        }

        // Get the STL file as a blob and create a download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${design.name || 'design'}.stl`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

      } catch (error) {
        console.error('Download error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to download STL file"
        });
      } finally {
        setIsDownloadingSTL(false);
      }
      return;
    }

    // STEP file handling remains the same...
    if (type === 'step') {
      try {
        setIsDownloadingSTEP(true);
        const stepFilePrice = 20;
        const response = await fetch('/api/step-file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            designId: design?.id,
            designName: design?.name || 'Untitled',
            fileType: type,
            customerEmail: session.user.email,
            metadata: {
              designId: design?.id,
              fileType: type,
              orderType: 'STEP_FILE',
              userEmail: session.user.email
            },
            email: session.user.email,
            amount_total: stepFilePrice * 100,
          }),
        });

        const data = await response.json();
        if (data.error || !data.url) {
          throw new Error(data.error || 'No checkout URL received');
        }

        window.location.href = data.url;
      } catch (error) {
        console.error('Checkout error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to initiate checkout"
        });
      } finally {
        setIsDownloadingSTEP(false);
      }
      return;
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
    // Map UI material names to pricing structure names
    const materialMap: Record<string, string> = {
      'WOOD_PLA': 'Wood-PLA',
      'PLA': 'PLA',
      'TPU': 'TPU',
      'RESIN': 'Resin',
      'ALUMINUM': 'Aluminum'
    };

    const mappedMaterial = materialMap[selectedType];
    const pricing = PRODUCT_PRICING[selectedSize]?.[mappedMaterial];
    
    if (!pricing || typeof pricing === 'string') {
      return 'Contact us';
    }

    const total = pricing.price * quantity;
    return `$${total.toFixed(2)}`;
  };

  const getButtonText = useCallback(() => {
    // Always show "Submit for Quote" for Custom size
    if (selectedSize === 'Custom') {
      return 'Submit for a Quote';
    }

    const materialMap: Record<string, string> = {
      'WOOD_PLA': 'Wood-PLA',
      'PLA': 'PLA',
      'TPU': 'TPU',
      'RESIN': 'Resin',
      'ALUMINUM': 'Aluminum'
    };

    const mappedMaterial = materialMap[selectedType];
    const pricing = PRODUCT_PRICING[selectedSize]?.[mappedMaterial];

    // Show "Submit for Quote" if pricing is 'contact' or undefined
    if (!pricing || typeof pricing === 'string') {
      return 'Submit for a Quote';
    }

    // If any required selections are missing, show complete selections
    if (!selectedSize || !selectedType) {
      return 'Complete Selections Above';
    }

    // If we have a valid price, show checkout button
    return 'Proceed to Checkout';
  }, [selectedSize, selectedType]);

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

  const handlePreviewClick = async () => {
    setIsGenerating(true);
    
    try {
      // If user is not signed in, still allow preview but show a prompt
      if (!session?.user) {
        toast({
          title: "Sign in recommended",
          description: "Create an account to save your designs",
          duration: 5000,
        });
      }
      
      // Generate preview for all users
      await generatePreview();
      
      // Navigate to preview page
      router.push('/preview');
      
    } catch (error) {
      console.error('Preview generation error:', error);
      toast({
        variant: "destructive",
        title: "Error generating preview",
        description: "Please try again"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        setLoading(true);
        const file = files[0];
        
        const base64Image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Failed to convert file'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        // Use anonymous ID if not signed in
        const userId = session?.user?.id || 'anonymous';
        
        // Save to Firebase using UID or anonymous
        const savedFirebaseDesign = await saveDesignToFirebase({
          imageUrl: base64Image,
          prompt: 'User uploaded design',
          userId: userId,
          mode: 'uploaded'
        });

        // Create design with Firebase ID
        const newDesign = {
          id: savedFirebaseDesign.id,
          title: 'Uploaded Design',
          images: [base64Image],
          prompt: 'User uploaded design'
        };

        const savedDesign = await addDesign(newDesign, userId);
        setSelectedDesign(savedDesign.images[0]);
        setShowAnalysis(true);

        toast({
          title: "Success",
          description: "Design uploaded successfully!"
        });
      } catch (error) {
        console.error('Error uploading design:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to upload design"
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const createCheckoutSession = async () => {
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipping_address_collection: {
            allowed_countries: ['US'],
          },
          shipping_options: [{
            shipping_rate: 'shr_1QmGrqCLoBz9jXRlBqFySsDC'
          }],
          metadata: {
            orderType: '3D_MANUFACTURING',
            type: '3d_print',
            designId: design?.id,
            material: selectedMaterial,
            size: selectedSize,
            quantity: quantity,
            comments: document.querySelector('textarea')?.value || ''
          },
          success_url: `${window.location.origin}/order-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/get-it-made?designId=${design?.id}`
        })
      });

      const data = await response.json();
      if (data.error || !data.url) {
        throw new Error(data.error || 'No checkout URL received');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to initiate checkout"
      });
    }
  };

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

        <div className="flex flex-col items-center justify-center py-12">
          <img 
            src="/images/taiyaki.svg"
            alt="Taiyaki Logo"
            className="w-24 h-24 mb-4" 
          />
          <h2 className="text-2xl font-bold text-center mb-2">
            Ready to make your design?
          </h2>
          <p className="text-gray-600 text-center">
            Upload your design file or create a new one to get started with manufacturing
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-rose-50 via-amber-50 via-emerald-50 via-sky-50 via-violet-50 to-white">
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
                  <div className="font-medium text-left text-lg">{MANUFACTURING_GROUPS['3D_PRINTING'].label}</div>
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
                  <div className="font-medium text-left text-lg">{MANUFACTURING_GROUPS['ADVANCED'].label}</div>
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
                <div className="aspect-square bg-gray-100 rounded-[10px] flex items-center justify-center overflow-hidden relative">
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
                  <div className="relative">
                    <Button
                      onClick={handle3DProcessing}
                      disabled={processing3D}
                      className="w-full mt-4 font-dm-sans font-medium text-sm rounded-[10px] bg-black text-white hover:bg-gray-800 
                        disabled:bg-gray-400 flex items-center justify-center gap-2 px-4 py-2 sm:py-3"
                    >
                      {processing3D ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Package className="w-4 h-4" />
                          Generate 3D Preview
                        </>
                      )}
                    </Button>

                    {/* Add the processing message right after the button */}
                    {showProcessingCard && (
                      <div className="mt-4 p-4 rounded-xl bg-gray-50">
                        <div className="flex flex-col gap-3">
                          <img 
                            src="/images/taiyaki.svg" 
                            alt="Taiyaki Logo" 
                            className="w-8 h-8 animate-[swim_3s_ease-in-out_infinite] self-center" 
                          />
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <p className="text-gray-700 font-medium">Processing your request</p>
                              <p className="text-sm text-gray-500">
                                Thank you for your patience as we handle the current volume of requests.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Download Files Section */}
                <div className="mt-4">
                  <Card className="bg-white rounded-[10px] shadow-sm border">
                    <CardContent className="p-4">
                      <div className="text-center space-y-4">
                        <div className="text-base font-medium text-gray-900 mb-4">
                          Get STL for 3D printing and STEP for CAD editing
                        </div>

                        {!design?.threeDData?.videoUrl && (
                          <p className="text-sm text-gray-600 mb-2">
                            Generate 3D preview first to download files
                          </p>
                        )}

                        <div className="space-y-4">
                          <div>
                            <Button 
                              variant="outline" 
                              className="w-full font-dm-sans font-medium text-sm rounded-[10px]" 
                              onClick={() => handleDownload('stl')}
                              disabled={!design?.threeDData?.videoUrl || isDownloadingSTL || isGLBProcessing}
                            >
                              {isDownloadingSTL ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Converting STL...
                                </>
                              ) : (!design?.threeDData?.glbUrls?.[0] || isGLBProcessing) ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Generating 3D Model for STL...
                                </>
                              ) : (
                                <>
                                  <FileDown className="mr-2 h-4 w-4" />
                                  Download STL File
                                </>
                              )}
                            </Button>
                            {!session?.user && (
                              <div className="text-sm text-center text-gray-600 mt-2">
                                Sign in to download files
                              </div>
                            )}
                          </div>

                          <div>
                            <Button 
                              variant="outline" 
                              className="w-full font-dm-sans font-medium text-sm rounded-[10px]" 
                              onClick={() => handleDownload('step')}
                              disabled={isDownloadingSTEP}
                            >
                              {isDownloadingSTEP ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Converting STEP...
                                </>
                              ) : (
                                <>
                                  <FileDown className="mr-2 h-4 w-4" />
                                  Purchase STEP File - $20
                                </>
                              )}
                            </Button>
                            {!session?.user && (
                              <div className="text-sm text-center text-gray-600 mt-2">
                                Sign in to purchase files
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
                    <option value="Small">Small - Up to 3.5 x 3.5 x 3.5"</option>
                    <option value="Medium">Medium - Up to 5 x 5 x 5"</option>
                    <option value="Large">Large - Up to 10 x 10 x 10"</option>
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
                  <span className="font-medium">
                    {(() => {
                      // Map UI material names to pricing structure names
                      const materialMap: Record<string, string> = {
                        'WOOD_PLA': 'Wood-PLA',
                        'PLA': 'PLA',
                        'TPU': 'TPU',
                        'RESIN': 'Resin',
                        'ALUMINUM': 'Aluminum'
                      };

                      const mappedMaterial = materialMap[selectedType];
                      const pricing = PRODUCT_PRICING[selectedSize]?.[mappedMaterial];
                      
                      if (!pricing || typeof pricing === 'string') {
                        return 'Contact us';
                      }
                      return `$${pricing.price.toFixed(2)}`;
                    })()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-dm-sans font-medium">{quantity}</span>
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

async function generatePreview() {
  // Add your preview generation logic here
  // This should work for both signed-in and unsigned users
  return new Promise(resolve => setTimeout(resolve, 1000));
}

export default function GetItMade() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <GetItMadeContent />
    </Suspense>
  );
} 