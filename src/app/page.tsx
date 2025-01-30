'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Wand, Upload, PenTool, Type, Download, Cog, Clock, ChevronRight, Edit, Loader2, History, X, FileText, Info, Package, Palette, RefreshCw, ChevronDown, ChevronUp, Check, Lock, Hammer, Box, Fish } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import { useDesignStore } from '@/lib/store/designs';
import { ManufacturingAnalysis } from '@/components/ManufacturingAnalysis';
import Link from 'next/link';
import { put } from '@vercel/blob';
import { AnalysisData } from '@/types/analysis';
import { useSession, signIn } from "next-auth/react";
import { ManufacturingRecommendations } from '@/components/ManufacturingRecommendations';
import { DesignFeeSection } from '@/components/DesignFeeSection';
import { SIZES } from '@/lib/types/sizes';
import { saveDesignToFirebase } from '@/lib/firebase/utils';
import { handleSignOut } from "@/lib/firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { process3DPreview } from "@/lib/firebase/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

const PROGRESS_STEPS = [
  {
    id: 1,
    name: 'Design Details',
    description: 'Enter product specifications',
    icon: Package
  },
  {
    id: 2,
    name: 'Manufacturing Method',
    description: 'Choose production method',
    icon: Cog
  },
  {
    id: 3,
    name: 'Review & Submit',
    description: 'Confirm and place order',
    icon: FileText
  }
];


const scaleToLog = (value: number): number => {
  // Convert linear 0-100 to logarithmic 1-10000
  return Math.round(Math.exp(Math.log(10000) * (value / 100)));
};

const scaleToLinear = (value: number): number => {
  // Convert logarithmic 1-10000 to linear 0-100
  return Math.round((Math.log(value) / Math.log(10000)) * 100);
};

const FALLBACK_IMAGE = '/placeholder-image.jpg'; // You'll need to add a placeholder image to your public folder

type InputMethod = 'text' | 'upload';

async function preprocessImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      // Create a regular HTML Image element
      const img = document.createElement('img');
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Fill white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate dimensions to maintain aspect ratio
        const scale = Math.min(256 / img.width, 256 / img.height);
        const x = (256 - img.width * scale) / 2;
        const y = (256 - img.height * scale) / 2;

        // Draw image
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        resolve(canvas.toDataURL('image/png', 1.0));
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Add these types at the top of your file or in a separate types file
interface EditHistoryEntry {
  originalImage: string;
  newImage: string;
  description: string;
  changes: string;
  timestamp: string;
  designId: string; // Reference to the design document
}

interface Design {
  id: string;
  title: string;
  images: string[];
  createdAt: string;
  prompt: string;
  originalDesignId?: string;
  editHistory?: EditHistoryEntry[];
  threeDData?: {
    videoUrl: string;
    glbUrls: string[];
    preprocessedUrl: string;
    timestamp: number;
  };
}

const generateDesignTitle = (prompt: string): string => {
  // Extract key product terms from the prompt
  const words = prompt.toLowerCase().split(' ');
  const productWords = words.filter(word => 
    !['a', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with'].includes(word)
  );
  
  // Capitalize first letter of each word
  const title = productWords
    .slice(0, 3) // Take first 3 significant words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
    
  return title || 'Untitled Design';
};

// Add this type for dimensions
interface Dimensions {
  size?: SizeType;
  unit: 'inches';
}

// Add this interface for tracking image states
interface ImageState {
  loading: boolean;
  error: boolean;
}

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

// Add manufacturing methods constant
const MANUFACTURING_METHODS = [
  {
    title: "FDM 3D Printing",
    description: "Standard 3D printing, great for most designs",
    recommended: false
  },
  {
    title: "SLS 3D Printing",
    description: "Professional-grade powder printing",
    recommended: false
  },
  {
    title: "Resin 3D Printing",
    description: "High-detail resin printing",
    recommended: false
  }
];

const getRecommendedMethod = (quantity: number, description: string = ''): string => {
  const desc = description.toLowerCase();
  
  // Extract key information from the description
  const needsDetail = desc.includes('detail') || desc.includes('smooth') || desc.includes('fine');
  const needsStrength = desc.includes('strong') || desc.includes('durable') || desc.includes('functional');
  const isComplex = desc.includes('complex') || desc.includes('intricate');
  
  // Decision tree based on requirements
  if (needsDetail && quantity <= 50) {
    return "Resin 3D Printing";
  }
  if ((needsStrength || isComplex) && quantity <= 200) {
    return "SLS 3D Printing";
  }
  // Default to FDM for most cases
  return "FDM 3D Printing";
};

// Add this helper function to get recommended materials
const getRecommendedMaterials = (quantity: number, productType: string = ''): string[] => {
  const type = productType.toLowerCase();
  
  // For detailed parts
  if (type.includes('detail') || type.includes('smooth')) {
    return ["Standard Resin", "Clear Resin"];
  }
  
  // For strong/durable parts
  if (type.includes('strong') || type.includes('durable')) {
    return ["Nylon", "Carbon Fiber Nylon"];
  }
  
  // For flexible parts
  if (type.includes('flexible') || type.includes('bendable')) {
    return ["TPU", "Flexible Resin"];
  }
  
  // Default to common materials
  return ["PLA", "PETG"];
};

// Add this helper function to convert blob URL to base64
const blobUrlToBase64 = async (blobUrl: string): Promise<string> => {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Headings
const headingStyles = {
  h1: "text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent", // Main title
  h2: "text-2xl font-semibold text-gray-800", // Section titles
  h3: "text-lg font-semibold text-gray-800", // Sub-section titles
  h4: "text-base font-medium text-gray-800" // Component titles
};

// Body text
const textStyles = {
  primary: "text-base text-gray-700", // Main content text
  secondary: "text-sm text-gray-600", // Secondary information
  small: "text-xs text-gray-500" // Helper text, labels
};

// Add style options
const STYLE_OPTIONS = [
  {
    id: 'cartoon',
    name: 'Cartoon',
    description: 'Adorable chibi character'
  },
  {
    id: 'realistic',
    name: 'Realistic',
    description: 'Photorealistic portrait'
  },
  {
    id: 'geometric',
    name: 'Geometric',
    description: 'Modern polygon sculpture'
  }
];

// Add this interface at the top of the file
interface GenerateResponse {
  success: boolean;
  imageUrl?: string;
  prompt?: string;
  error?: string;
}

const handleGenerateDesign = async () => {
  if (!textPrompt.trim()) {
    toast({
      variant: "destructive",
      title: "Error",
      description: "Please enter a description"
    });
    return;
  }

  setGeneratingDesign(true);
  let retryCount = 0;
  const maxRetries = 3;
  const baseDelay = 2000; // Base delay of 2 seconds

  while (retryCount < maxRetries) {
    try {
      // Prepare the prompt
      let fullPrompt = textPrompt;
      if (inspirationImages.length > 0) {
        try {
          const description = await analyzeImageForEdit(inspirationImages[0]);
          fullPrompt = `Using the style of the reference image which shows ${description}, ${textPrompt}`;
        } catch (error) {
          console.error('Error analyzing reference image:', error);
        }
      }

      if (selectedStyle) {
        fullPrompt += `, in a ${selectedStyle} style`;
      }

      // Make the API call with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('/api/generate-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          style: selectedStyle,
          userId: session?.user?.id || 'anonymous',
          n: 1,
          size: "1024x1024"
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || 'Failed to generate design';
        } catch (e) {
          errorMessage = errorText || 'Failed to generate design';
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (!data.success || !data.imageUrl) {
        throw new Error('No image generated');
      }

      // Save to Firebase
      const savedDesign = await saveDesignToFirebase({
        imageUrl: data.imageUrl,
        prompt: fullPrompt,
        userId: session?.user?.id || 'anonymous',
        mode: 'generated'
      });

      setSelectedDesign(savedDesign.imageUrl);
      setShowAnalysis(true);
      setScrollToAnalysis(true);

      toast({
        title: "Success",
        description: "Design generated successfully!"
      });
      break; // Exit loop on success

    } catch (error) {
      console.error(`Attempt ${retryCount + 1} failed:`, error);
      retryCount++;

      if (retryCount === maxRetries) {
        throw error; // Let the outer catch block handle the final error
      } else {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, baseDelay * Math.pow(2, retryCount)));
      }
    }
  }

  setGeneratingDesign(false);
};

// Add this constant for style prompts
const STYLE_PROMPTS: Record<string, string> = {
  cartoon: "Create in a cute, stylized cartoon style with clean lines and vibrant colors",
  realistic: "Generate a photorealistic 3D render with detailed textures and physically accurate materials",
  geometric: "Design using clean geometric shapes and minimal modern style"
};

// Add these constants near the top of the file with other constants
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

// Add this helper function
const getPriceAndDelivery = (size: string, material: string) => {
  const materialKey = material.replace(' PLA', '') as keyof typeof PRICING.Mini;
  const sizeKey = size as keyof typeof PRICING;
  
  const price = PRICING[sizeKey]?.[materialKey];
  const delivery = DELIVERY_ESTIMATES[sizeKey]?.[materialKey];
  
  return { price, delivery };
};

// Add this helper function
const getMaterialRecommendation = async (imageUrl: string) => {
  try {
    // If the image is a blob URL, convert it to base64
    let processedImageUrl = imageUrl;
    if (imageUrl.startsWith('blob:')) {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      processedImageUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }

    const response = await fetch('/api/analyze-material', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: processedImageUrl })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze design');
    }

    const data = await response.json();
    if (!data.recommendedMaterial || !data.reason) {
      throw new Error('Invalid response from material analysis');
    }

    return data;
  } catch (error) {
    console.error('Error getting material recommendation:', error);
    throw error instanceof Error ? error : new Error('Failed to analyze design');
  }
};

const analyzeImageForEdit = async (imageUrl: string) => {
  try {
    // Convert blob URL to base64 if needed
    let processedImageUrl = imageUrl;
    if (imageUrl.startsWith('blob:')) {
      processedImageUrl = await blobUrlToBase64(imageUrl);
    }

    const response = await fetch('/api/analyze-design', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        imageUrl: processedImageUrl,
        prompt: "Describe this image's key visual elements in one to two sentence" // Request a concise response
      })
    });

    if (!response.ok) {
      throw new Error('Failed to analyze design');
    }

    const data = await response.json();
    if (!data.description) {
      throw new Error('Invalid analysis response');
    }

    return data.description;
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
};

// Add this component near the top of your file
const LoadingSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-square bg-gray-200 rounded-xl mb-4" />
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
    <div className="h-4 bg-gray-200 rounded w-1/2" />
  </div>
);

// Update the Process3DResponse interface
interface Process3DResponse {
  success: boolean;
  status: string;
  video_url?: string;
  preprocessed_url?: string;
  glb_urls?: string[];
  timestamp: number;
  userId: string;
}

// Add these constants at the top of the file
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

export default function LandingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [inputMethod, setInputMethod] = useState<InputMethod>('text');
  const [textPrompt, setTextPrompt] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { designs, addDesign, clearDesigns, updateDesign, loadUserDesigns } = useDesignStore();
  const [selectedDesign, setSelectedDesign] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>('FDM 3D Printing');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const { data: session, status } = useSession();
  const [imageStates, setImageStates] = useState<Record<string, ImageState>>({});
  const [hasUsedFreeDesign, setHasUsedFreeDesign] = useState(false);
  const [dimensions, setDimensions] = useState<Dimensions>({
    size: undefined,
    unit: 'inches'
  });
  const [dimensionsError, setDimensionsError] = useState<string | null>(null);
  const [showDesignFee, setShowDesignFee] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<string>("Standard PLA"); // Set PLA as default
  const [isEditingDimensions, setIsEditingDimensions] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [currentStep, setCurrentStep] = useState(1);
  const [designComments, setDesignComments] = useState('');
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [inspirationImages, setInspirationImages] = useState<string[]>([]);
  const MAX_INSPIRATION_IMAGES = 3;
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [recommendationInfo, setRecommendationInfo] = useState<{
    material: string;
    reason: string;
  } | null>(null);
  const [isDesignFinalized, setIsDesignFinalized] = useState(false);
  // Add this ref at the top of your component
  const analysisRef = useRef<HTMLDivElement>(null);
  // Add this at the top of your component with other state declarations
  const [scrollToAnalysis, setScrollToAnalysis] = useState(false);
  // Add these states at the top with other state declarations
  const [processing3D, setProcessing3D] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Add state for reference image
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  // Add state for selected styles if not already present
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [designPrompt, setDesignPrompt] = useState<string>('');
  // Add state at the top with other states
  const [showProcessingCard, setShowProcessingCard] = useState(false);

  // Load user designs when session changes
  useEffect(() => {
    if (session?.user?.id) {
      loadUserDesigns(session.user.id);
    }
  }, [session?.user?.id]);

  const handleImageError = (imageUrl: string) => (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.target as HTMLImageElement;
    setImageStates(prev => ({
      ...prev,
      [imageUrl]: { loading: false, error: true }
    }));
    img.src = '';
  };

  const handleImageLoad = (imageUrl: string) => () => {
    setImageStates(prev => ({
      ...prev,
      [imageUrl]: { loading: false, error: false }
    }));
  };

  const validateDimensions = () => {
    if (!dimensions.size) {
      setDimensionsError('Please select a size');
      return false;
    }
    setDimensionsError(null);
    return true;
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
        const savedDesign = await saveDesignToFirebase({
          imageUrl: base64Image,
          prompt: 'User uploaded design',
          userId: userId,
          mode: 'uploaded'
        });

        // Create new design for local store
        const newDesign = {
          id: savedDesign.id,
          title: 'Uploaded Design',
          images: [savedDesign.imageUrl],
          createdAt: new Date().toISOString(),
          prompt: ''
        };

        // Add to local store
        addDesign(newDesign, userId);
        
        setSelectedDesign(savedDesign.imageUrl);
        setShowAnalysis(true);
        setScrollToAnalysis(true);

        toast({
          title: "Success",
          description: "Design uploaded successfully!"
        });
      } catch (error) {
        console.error('Upload failed:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to upload image"
        });
      } finally {
        setLoading(false);
      }
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      try {
        setLoading(true);
        const file = files[0];

        if (!file.type.startsWith('image/')) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Please upload an image file"
          });
          return;
        }

        // Convert to base64
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

        // Save to Firebase first
        const userId = session?.user?.id || 'anonymous';
        const savedDesign = await saveDesignToFirebase({
          imageUrl: base64Image,
          prompt: 'User uploaded design',
          userId,
          mode: 'uploaded'
        });

        // Create new design for local store
        const newDesign = {
          id: savedDesign.id,
          title: 'Uploaded Design',
          images: [savedDesign.imageUrl],
          createdAt: new Date().toISOString(),
          prompt: ''
        };

        // Add to local store
        addDesign(newDesign, userId);
        
        // Update UI
        setSelectedDesign(savedDesign.imageUrl);
        setShowAnalysis(true);
        setScrollToAnalysis(true);

        toast({
          title: "Success",
          description: "Design uploaded successfully!"
        });
      } catch (error) {
        console.error('Upload failed:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to upload image"
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGenerateClick = async () => {
    if (!textPrompt.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a description"
      });
      return;
    }
  
    setGenerating(true);
    try {
      let fullPrompt = '';
      if (inspirationImages.length > 0) {
        try {
          const description = await analyzeImageForEdit(inspirationImages[0]);
          fullPrompt = `Using the style of the reference image which shows ${description}, `;
        } catch (error) {
          console.error('Error analyzing reference image:', error);
        }
      }
  
      fullPrompt += textPrompt;
      if (selectedStyle) {
        fullPrompt += `, in a ${selectedStyle} style`;
      }
  
      const response = await fetch('/api/generate-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          style: selectedStyle,
          userId: session?.user?.id || 'anonymous',
          n: 1,
          size: "1024x1024"
        }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to generate design');
      }
  
      const result = await response.json();
      
      if (result?.imageUrl) {
        const userId = session?.user?.id || 'anonymous';
  
        // Create the design object
        const newDesign = {
          id: Date.now().toString(), // Temporary ID
          title: textPrompt ? generateDesignTitle(textPrompt) : 'New Design',
          images: [result.imageUrl],
          createdAt: new Date().toISOString(),
          prompt: fullPrompt,
          style: selectedStyle,
          referenceImages: inspirationImages
        };
  
        // Immediately add to local store first
        await addDesign(newDesign, userId);
        setSelectedDesign(result.imageUrl);
        setShowAnalysis(true);
  
        // Then save to Firebase in background
        try {
          const savedDesign = await saveDesignToFirebase({
            imageUrl: result.imageUrl,
            prompt: fullPrompt,
            userId,
            mode: 'generated'
          });
  
          // Update the design with Firebase ID
          updateDesign(newDesign.id, { id: savedDesign.id });
        } catch (error) {
          console.error('Firebase save error:', error);
          // Design is still in local store even if Firebase fails
        }
  
        toast({
          title: "Success",
          description: "Design generated successfully!"
        });
      }
    } catch (error) {
      console.error('Generation failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate design"
      });
    } finally {
      setGenerating(false);
    }
  };

  const getPromptForMethod = async () => {
    let basePrompt = BASE_SETTINGS;
    
    // Add selected styles to the prompt
    if (selectedStyles.length > 0) {
      basePrompt += ` Style: ${selectedStyles.join(', ')}. `;
    }

    // If there's a reference image, analyze it and add to prompt
    if (inspirationImages.length > 0) {
      try {
        // Analyze each reference image
        for (const imageUrl of inspirationImages) {
          const description = await analyzeImageForEdit(imageUrl);
          basePrompt += ` Reference image shows: ${description}. `;
        }
      } catch (error) {
        console.error('Error analyzing reference images:', error);
      }
    }

    // Add text prompt if provided
    if (textPrompt) {
      basePrompt += ` ${textPrompt}`;
    }

    return { prompt: basePrompt };
  };

  const saveImages = async (images: string[]) => {
    if (process.env.NODE_ENV === 'development') {
      // For development, just return the base64 images
      console.warn('Running in development mode - skipping Blob storage');
      return images;
    }

    // Production code
    try {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
      }

      const uploadPromises = images.map(async (imageData) => {
        const blob = await put(`generated-${Date.now()}.png`, imageData, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN
        });
        return blob.url;
      });

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error saving images:', error);
      throw new Error('Failed to save images. Please check your storage configuration.');
    }
  };

  const handleDownload = async (imageUrl: string) => {
    try {
      // If it's a blob URL, convert it to base64 first
      let downloadUrl = imageUrl;
      if (imageUrl.startsWith('blob:')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        downloadUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const response = await fetch('/api/download-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: downloadUrl })
      });

      if (!response.ok) {
        throw new Error('Failed to download image');
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated-design.png';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Error downloading image:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download image"
      });
    }
  };

  // Main edit design handler
  const handleEditDesign = async () => {
    console.log('1. Edit initiated', {
      hasEditPrompt: !!editPrompt,
      hasSelectedDesign: !!selectedDesign
    });

    if (!editPrompt || !selectedDesign) return;

    setIsEditing(true);
    try {
      console.log('2. Making edit request to /api/editImage', {
        imageUrl: selectedDesign?.substring(0, 50) + '...',
        promptLength: editPrompt.length
      });

      const response = await fetch('/api/editImage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: selectedDesign,
          prompt: editPrompt
        }),
      });

      console.log('3. Edit response received', {
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to edit design');
      }

      const data = await response.json();
      if (!data.success || !data.imageUrl) {
        throw new Error('Failed to generate edited image');
      }

      // Save to Firebase
      const userId = session?.user?.id || 'anonymous';
      const currentDesign = designs.find(d => d.images.includes(selectedDesign));
      if (!currentDesign) return;

      // Save edited version
      const savedDesign = await saveDesignToFirebase({
        imageUrl: data.imageUrl,
        prompt: editPrompt,
        userId,
        mode: 'edited',
        originalDesignId: currentDesign.id
      });

      console.log('Edited design saved to Firebase:', savedDesign);

      // Create a new design entry
      const newDesign = {
        id: savedDesign.id,
        title: generateDesignTitle(editPrompt),
        images: [savedDesign.imageUrl],
        createdAt: new Date().toISOString(),
        prompt: editPrompt,
        originalDesignId: currentDesign.id,
        editHistory: [{
          originalImage: selectedDesign,
          newImage: savedDesign.imageUrl,
          changes: editPrompt,
          timestamp: new Date().toISOString(),
          designId: currentDesign.id
        }]
      };

      // Add to local store
      addDesign(newDesign, userId);
      
      // Update UI
      setSelectedDesign(savedDesign.imageUrl);
      setShowEditDialog(false);
      setEditPrompt('');
      
      // Reset analysis states
      setIsDesignFinalized(false);
      setRecommendationInfo(null);

      toast({
        title: "Success",
        description: "Design edited successfully"
      });

    } catch (error) {
      console.error('Error editing design:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to edit design'
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleManufacturingCheckout = (designId: string) => {
    const design = designs.find(d => d.id === designId);
    if (design?.analysis) {
      updateDesign(designId, {
        analysis: {
          ...design.analysis,
          status: 'checkout'
        }
      });
      
      // Navigate to checkout or show checkout modal
      // ... implement checkout flow
    }
  };

  const handleRevertToVersion = (originalImage: string, versionUrl: string) => {
    const designToUpdate = designs.find(d => 
      d.images.includes(originalImage)
    );

    if (designToUpdate) {
      // Keep the existing analysis when switching versions
      const currentAnalysis = designToUpdate.analysis || {
        description: '',
        recommendedMethod: '',
        recommendedMaterials: []
      };

      // Update versions
      const updatedVersions = {
        ...designToUpdate.imageVersions,
        [originalImage]: {
          history: [...(designToUpdate.imageVersions?.[originalImage]?.history || []), originalImage].filter(v => v !== versionUrl),
          current: versionUrl
        }
      };

      // Create a new design object with the updated version and preserved analysis
      const updatedDesign = {
        ...designToUpdate,
        images: [versionUrl, ...designToUpdate.images.filter(img => img !== originalImage)],
        imageVersions: updatedVersions,
        analysis: currentAnalysis // Preserve the existing analysis
      };

      // Update the design in the store
      updateDesign(designToUpdate.id, updatedDesign);

      // Update UI state
      setSelectedDesign(versionUrl);
      setShowVersionHistory(false);
      
      // Update manufacturing recommendations based on the preserved analysis
      if (currentAnalysis) {
        const recommendedMethod = getRecommendedMethod(quantity, currentAnalysis.description);
        setSelectedMethod(recommendedMethod);
        
        const recommendedMaterials = getRecommendedMaterials(quantity, currentAnalysis.description);
        if (recommendedMaterials.length > 0) {
          setSelectedMaterial(recommendedMaterials[0]);
        }
      }

      toast({
        title: "Success",
        description: "Reverted to previous version while maintaining analysis"
      });
    }
  };

  const determineRecommendedMethod = (analysis: any, volume: number) => {
    if (!analysis) return '3D Printing';
    
    const { complexity = '', features = [], dimensions = {}, category = '' } = analysis;
    
    // High volume always prefers injection molding or die casting for suitable materials
    if (volume > 1000) {
      if (category === 'mechanical' || features.includes('metal')) {
        return 'Die Casting';
      }
      return 'Injection Molding';
    }
    
    // Check for flat objects
    if (features.includes('flat') || dimensions.height < 5) {
      return 'Laser Cutting';
    }
    
    // Low volume + complex geometry = 3D printing
    if (volume <= 100 && (complexity === 'high' || features.includes('organic'))) {
      return '3D Printing';
    }
    
    // Check for precision requirements
    if (category === 'mechanical' || features.includes('precision')) {
      return 'CNC Machining';
    }
    
    // Default to 3D printing for prototypes and small runs
    return '3D Printing';
  };

  const handleProceed = async () => {
    if (!selectedMethod || !selectedMaterial) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a material before proceeding"
      });
      return;
    }

    try {
      // Create order with selected method and material
      const order = {
        designId: selectedDesign,
        manufacturingMethod: selectedMethod,
        material: selectedMaterial,
        dimensions,
      };
      
      // Implement payment logic here
      
      toast({
        title: "Success",
        description: "Payment processed successfully. Our team will contact you shortly."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Payment failed. Please try again."
      });
    }
  };

  const handleDimensionsDetected = (detectedDimensions: Dimensions | undefined) => {
    if (detectedDimensions) {
      setDimensions(prev => ({
        ...prev,
        length: detectedDimensions.length || prev.length,
        width: detectedDimensions.width || prev.width,
        height: detectedDimensions.height || prev.height,
        // Keep existing unit if dimensions are detected
        unit: prev.unit
      }));
    }
  };

  const analyzeImage = async () => {
    if (!selectedDesign) return;
    
    setIsUpdatingPlan(true);
    try {
      // Make sure we have base64 data
      const imageData = selectedDesign.startsWith('blob:') 
        ? await blobUrlToBase64(selectedDesign)
        : selectedDesign;

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: imageData,
          prompt: "Analyze this product design in one sentence:\n" +
                  "What is this product and what is it made of (metal, plastic, etc)?",
          model: 'gpt-4o'
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');

      // Structure the analysis data
      const analysisData = {
        description: data.description || "Simple product design",
        recommendedMethod: getRecommendedMethod(quantity, data.description),
        recommendedMaterials: getRecommendedMaterials(quantity, data.description)
      };

      // Update the design store with analysis
      const design = designs.find(d => d.images.includes(selectedDesign));
      if (design) {
        updateDesign(design.id, {
          analysis: analysisData
        });

        // Set recommended manufacturing method
        setSelectedMethod(analysisData.recommendedMethod);
      }

      return analysisData;
    } catch (error) {
      throw error;
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedDesign) return;
    
    setIsUpdatingPlan(true);
    try {
      // Debug log
      console.log('Selected design:', selectedDesign);

      // Make sure we have base64 data
      let imageData;
      try {
        imageData = selectedDesign.startsWith('blob:') 
          ? await blobUrlToBase64(selectedDesign)
          : selectedDesign;
        
        // Debug log
        console.log('Image data type:', typeof imageData);
        console.log('Image data starts with:', imageData.substring(0, 50));
      } catch (error) {
        console.error('Error converting image:', error);
        throw new Error('Failed to process image data');
      }

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Add cache control
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ 
          imageUrl: imageData,
          prompt: "Analyze this product design in one sentence:\n" +
                  "What is this product and what is it made of (metal, plastic, etc)?",
          model: 'gpt-4o'
        }),
      });

      // Debug log
      console.log('Response status:', response.status);
      
      // Get the raw text first to debug
      const rawText = await response.text();
      console.log('Raw response:', rawText);

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        console.error('Failed to parse response as JSON:', error);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) throw new Error(data.error || 'Analysis failed');

      // Get recommendations based on quantity and product description
      const recommendedMethod = getRecommendedMethod(quantity, data.description);
      const recommendedMaterials = getRecommendedMaterials(quantity, data.description);

      // Update the design with analysis results
      const design = designs.find(d => d.images.includes(selectedDesign));
      if (design) {
        updateDesign(design.id, {
          analysis: {
            description: data.description || "Simple product design",
            recommendedMethod: recommendedMethod,
            recommendedMaterials: recommendedMaterials
          }
        });
      }

      // Update the UI
      setSelectedMethod(recommendedMethod);
      
      // Find and update the recommended method in MANUFACTURING_METHODS
      const methodDetails = MANUFACTURING_METHODS.find(m => m.title === recommendedMethod);
      if (methodDetails) {
        methodDetails.recommended = true;
        // Auto-select the first recommended material if available
        if (recommendedMaterials.length > 0) {
          setSelectedMaterial(recommendedMaterials[0]);
        }
        // Reset other methods' recommended status
        MANUFACTURING_METHODS.forEach(m => {
          if (m.title !== recommendedMethod) {
            m.recommended = false;
          }
        });
      }

      toast({
        title: "Success",
        description: "Manufacturing analysis complete"
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze design. Please try again."
      });
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  // Update the useEffect to handle material recommendations
  useEffect(() => {
    if (selectedDesign && designs.find(d => d.images.includes(selectedDesign))) {
      const design = designs.find(d => d.images.includes(selectedDesign));
      const description = design?.analysis?.description || '';
      const newRecommendedMethod = getRecommendedMethod(quantity, description);
      const newRecommendedMaterials = getRecommendedMaterials(quantity, description);
      
      setSelectedMethod(newRecommendedMethod);
      
      // Auto-select the first recommended material
      if (newRecommendedMaterials.length > 0) {
        setSelectedMaterial(newRecommendedMaterials[0]);
      }
    }
  }, [quantity, selectedDesign, designs]);

  const handleGenerateManufacturingPlan = async () => {
    if (!validateDimensions()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter valid dimensions"
      });
      return;
    }

    try {
      setIsUpdatingPlan(true);

      const selectedDesignData = designs.find(d => d.images.includes(selectedDesign));
      if (!selectedDesignData) {
        throw new Error('Design not found');
      }

      // Create manufacturing plan data
      const manufacturingPlan = {
        designId: selectedDesignData.id,
        material: selectedMaterial,
        quantity: quantity,
        dimensions: dimensions,
        designComments: designComments
      };

      // Update the design store
      updateDesign(selectedDesignData.id, {
        ...selectedDesignData,
        manufacturingPlan
      });

      toast({
        title: "Success",
        description: "Manufacturing plan generated successfully!"
      });

      setCurrentStep(currentStep + 1);

    } catch (error) {
      console.error('Error generating manufacturing plan:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate manufacturing plan"
      });
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handleAnalysisComplete = (analysisData: any, designId?: string) => {
    setAnalysisResults(analysisData);
    setIsAnalyzing(false);

    // If designId is provided, update the design's manufacturing option
    if (designId) {
      const design = designs.find(d => d.id === designId);
      if (design) {
        updateDesign(designId, {
          manufacturingOption: analysisData.selectedOption ? {
            name: analysisData.selectedOption.name,
            description: analysisData.selectedOption.description,
            setup: analysisData.selectedOption.costs.setup,
            perUnit: analysisData.selectedOption.costs.perUnit,
            leadTime: analysisData.selectedOption.leadTime
          } : undefined
        });

        // Set the recommended material
        if (analysisData.recommendedMaterials?.length > 0) {
          setSelectedMaterial(analysisData.recommendedMaterials[0]);
        }
      }
    }
  };

  const handleRedoAnalysis = async () => {
    if (!selectedDesign) return;

    setIsAnalyzing(true);
    try {
      // If selectedDesign is a blob URL or base64, use it directly
      let imageData = selectedDesign;
      if (selectedDesign.startsWith('blob:')) {
        const response = await fetch(selectedDesign);
        const blob = await response.blob();
        imageData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: imageData
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
      
      // Update the design with the new analysis
      const currentDesign = designs.find(d => d.images.includes(selectedDesign));
      if (currentDesign) {
        const updatedAnalysis = {
          productDescription: data.description,
          dimensions: dimensions,
          manufacturingOptions: [],
          status: 'analyzed' as const,
          features: data.features,
          recommendedMethod: data.recommendedMethod,
          recommendedMaterials: data.recommendedMaterials
        };

        updateDesign(currentDesign.id, {
          analysis: updatedAnalysis
        });

        // Auto-select the recommended method
        setSelectedMethod(data.recommendedMethod);
        
        // Auto-select the first recommended material if available
        if (data.recommendedMaterials && data.recommendedMaterials.length > 0) {
          setSelectedMaterial(data.recommendedMaterials[0]);
        }
      }

      handleAnalysisComplete(data);

      toast({
        title: "Success",
        description: "Design analyzed successfully"
      });

    } catch (error) {
      console.error('Analysis failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze design"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Update the effect that loads stored analysis
  useEffect(() => {
    if (selectedDesign) {
      const currentDesign = designs.find(d => d.images.includes(selectedDesign));
      
      // Reset states for new design selection
      setIsDesignFinalized(false);
      setRecommendationInfo(null);
      setSelectedMaterial('');
      setDimensions({ size: undefined, unit: 'inches' });
      setQuantity(1);
      setDesignComments('');

      // Only restore states if this design has been previously analyzed
      if (currentDesign?.analysis?.isFinalized && 
          currentDesign.analysis.recommendedMaterial && 
          currentDesign.analysis.reason) {
        setIsDesignFinalized(true);
        setRecommendationInfo({
          material: currentDesign.analysis.recommendedMaterial,
          reason: currentDesign.analysis.reason
        });
        setSelectedMaterial(currentDesign.analysis.recommendedMaterial);
        
        // Restore other states if they exist
        if (currentDesign.analysis.dimensions) {
          setDimensions(currentDesign.analysis.dimensions);
        }
        if (currentDesign.analysis.quantity) {
          setQuantity(currentDesign.analysis.quantity);
        }
        if (currentDesign.analysis.comments) {
          setDesignComments(currentDesign.analysis.comments);
        }
      }
    }
  }, [selectedDesign, designs]);

  // Add this effect to reset states when generating a new design
  useEffect(() => {
    if (generating) {
      setIsDesignFinalized(false);
      setRecommendationInfo(null);
      setSelectedMaterial('');
      setDimensions({ size: undefined, unit: 'inches' });
      setQuantity(1);
      setDesignComments('');
    }
  }, [generating]);

  // Add this useEffect to handle the scrolling
  useEffect(() => {
    if (scrollToAnalysis && analysisRef.current) {
      // Add a small delay to ensure the state has updated
      setTimeout(() => {
        const headerOffset = 80; // Adjust this value based on your header height
        const elementPosition = analysisRef.current?.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
        
        setScrollToAnalysis(false);
      }, 100);
    }
  }, [scrollToAnalysis]);

  const handleImageUpload = async (file: File) => {
    try {
      console.log('1. Starting image upload...');
      setIsLoading(true);

      // First, convert the file to base64
      const base64String = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      console.log('2. Image converted to base64');

      // Save to Firebase
      const tempUserId = 'temp-user-123'; // We'll replace this with real auth later
      const savedDesign = await saveDesignToFirebase({
        imageUrl: base64String,
        prompt: 'User uploaded design',
        userId: tempUserId,
        mode: 'uploaded'
      });

      console.log('3. Design saved to Firebase:', savedDesign);

      setCurrentDesign({
        id: savedDesign.id,
        imageUrl: savedDesign.imageUrl,
        prompt: 'User uploaded design'
      });

      toast({
        title: "Success",
        description: "Image uploaded successfully"
      });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to upload image'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Update your file input handler
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleImageUpload(file);
    }
  };

  // Or if you're using react-dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      console.log('1. File dropped, processing...');
      const file = acceptedFiles[0];
      if (!file) return;

      setIsLoading(true);

      // Convert file to base64
      const base64String = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('2. File converted to base64');
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });

      // Save to Firebase
      const tempUserId = 'temp-user-123';
      console.log('3. Calling saveDesignToFirebase');
      const savedDesign = await saveDesignToFirebase({
        imageUrl: base64String,
        prompt: 'User uploaded design',
        userId: tempUserId,
        mode: 'uploaded'
      });

      console.log('4. Design saved:', savedDesign);

      // Update UI with the saved design
      setSelectedDesign(savedDesign.imageUrl);
      
      toast({
        title: "Success",
        description: "Design uploaded successfully"
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload design"
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // When generated image is clicked
  const handleDesignClick = async (imageUrl: string, isReferenceImage: boolean = false) => {
    if (isReferenceImage) {
      setSelectedDesign(imageUrl);
      return;
    }

    try {
      const userId = session?.user?.id;
      if (!userId) {
        toast({
          title: "Error",
          description: "Please sign in to save designs",
          variant: "destructive"
        });
        return;
      }

      const savedDesign = await saveDesignToFirebase({
        imageUrl,
        prompt: designPrompt,
        userId,
        mode: 'generated'
      });

      // Add to local store
      const newDesign = {
        id: savedDesign.id,
        images: [savedDesign.imageUrl],
        prompt: designPrompt,
        createdAt: new Date().toISOString(),
        userId
      };
      
      addDesign(newDesign, userId);
      setSelectedDesign(savedDesign.imageUrl);
      
      toast({
        title: "Success",
        description: "Design saved successfully"
      });
    } catch (error) {
      console.error('Error saving design:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save design"
      });
    }
  };

  // In page.tsx, update the handle3DProcessing function:
const handle3DProcessing = async () => {
  if (!selectedDesign) {
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
    const currentDesign = designs.find(d => d.images.includes(selectedDesign));
    
    if (!currentDesign) {
      throw new Error('No design found');
    }

    // This will now return as soon as video is ready
    const result = await process3DPreview(currentDesign, userId, setProcessing3D);
    
    if (result.success) {
      // Update local state immediately with video data
      updateDesign(currentDesign.id, {
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

  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const localUrl = URL.createObjectURL(file);
      setInspirationImages(prev => [...prev, localUrl]);

      try {
        const description = await analyzeImageForEdit(localUrl);
        setDesignPrompt(prev => {
          const newPrompt = prev ? `${prev} ${description}` : description;
          return newPrompt.trim();
        });
      } catch (error) {
        console.error('Error analyzing reference image:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to analyze reference image"
        });
      }
    } catch (error) {
      console.error('Error handling reference image:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add reference image"
      });
    }
  };

  // Add function to remove reference image
  const handleRemoveReferenceImage = () => {
    if (referenceImage) {
      URL.revokeObjectURL(referenceImage);
      setReferenceImage(null);
    }
  };

  // Add handler for style selection
  const handleStyleSelect = (style: string) => {
    setSelectedStyles(prev => 
      prev.includes(style) 
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
  };

  const handleSignOutClick = async () => {
    try {
      await handleSignOut();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error signing out",
        description: "Please try again"
      });
    }
  };

  // Add console.log to debug session data
  useEffect(() => {
    console.log('Session status:', status);
    console.log('Session data:', session);
  }, [session, status]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen relative bg-white">
      {/* Fixed Background Layer - Move to lowest z-index */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-9">
        {/* Light Blue Gradient */}
        <div 
          className="absolute w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            top: '-200px',
            left: '-100px',
            background: 'radial-gradient(circle, #73D2DE 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        
        {/* Orange Gradient */}
        <div 
          className="absolute w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            top: '20%',
            right: '-100px',
            background: 'radial-gradient(circle, #F57C00 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        
        {/* Yellow Gradient */}
        <div 
          className="absolute w-[800px] h-[800px] rounded-full opacity-20"
          style={{
            bottom: '-200px',
            left: '30%',
            background: 'radial-gradient(circle, #FDB827 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </div>

      {/* Main Content Layer - Keep at normal z-index */}
      <div className="relative container mx-auto px-4 py-12">
        <div className="mb-12">
          <div className="flex items-center justify-between">
            {/* Remove auth section */}
          </div>
        </div>

        {/* Update card backgrounds to be more transparent */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 -mt-12">
          <div>
            {/* Input Method Selection Card */}
            <div className="bg-white border border-gray-200 hover:border-gray-300 backdrop-blur-sm rounded-2xl shadow-sm p-3 transition-all">
              {/* Header Section */}
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-2xl font-dm-sans font-medium text-gray-900">
                  Text-to-Product. Image-to-Product.
                </h2>
              </div>

              {/* Tab Selection */}
              <div className="grid grid-cols-2 gap-0.5 p-1 bg-gray-100 rounded-xl m-4">
                <button
                  onClick={() => setInputMethod('text')}
                  className={`
                    py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all
                    ${inputMethod === 'text'
                      ? 'bg-white shadow-sm text-black'
                      : 'bg-transparent text-gray-600 hover:bg-white/50'
                    }
                  `}
                >
                  <Wand className={`w-5 h-5 ${inputMethod === 'text' ? 'text-black' : 'text-gray-400'}`} />
                  <span className="font-medium">Generate New Idea</span>
                </button>

                <button
                  onClick={() => setInputMethod('upload')}
                  className={`
                    py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all
                    ${inputMethod === 'upload'
                      ? 'bg-white shadow-sm text-black'
                      : 'bg-transparent text-gray-600 hover:bg-white/50'
                    }
                  `}
                >
                  <Upload className={`w-5 h-5 ${inputMethod === 'upload' ? 'text-black' : 'text-gray-400'}`} />
                  <span className="font-medium">Upload Existing Idea</span>
                </button>
              </div>

              {/* Content Section */}
              <div className="p-6">
                <div className="space-y-6">
                  {inputMethod === 'text' ? (
                    // Text Input Section
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <FileText className="w-4 h-4" />
                          <span>Describe your idea</span>
                        </div>
                        <textarea
                          value={textPrompt}
                          onChange={(e) => setTextPrompt(e.target.value)}
                          placeholder="Describe what you'd like to create..."
                          className="w-full h-32 px-4 py-3 border rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400"
                        />
                      </div>

                      {/* Reference Image Upload */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Upload className="w-4 h-4" />
                          <span>Add reference image (optional)</span>
                        </div>
                        <div className="space-y-4">
                          {/* Display uploaded reference images */}
                          {inspirationImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                              {inspirationImages.map((imageUrl, index) => (
                                <div key={index} className="relative aspect-square">
                                  <img
                                    src={imageUrl}
                                    alt={`Reference ${index + 1}`}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInspirationImages(prev => prev.filter((_, i) => i !== index));
                                    }}
                                    className="absolute top-1 right-1 p-1 bg-white rounded-full hover:bg-gray-100"
                                  >
                                    <X className="w-4 h-4 text-gray-600" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Upload button */}
                          {inspirationImages.length < MAX_INSPIRATION_IMAGES && (
                            <div
                              onClick={() => fileInputRef.current?.click()}
                              className="border-2 border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:border-blue-500 transition-colors text-center"
                            >
                              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                              <p className="text-gray-600">Drop a reference image, or click to browse</p>
                              <p className="text-sm text-gray-500">Helps us better understand your vision</p>
                              <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleReferenceImageUpload}
                                accept="image/png,image/jpeg,image/svg+xml"
                                className="hidden"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Style Selection */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Palette className="w-4 h-4" />
                          <span>Style (Optional)</span>
                        </div>
                        
                        {/* Mobile-friendly style buttons */}
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: 'cartoon', label: 'Cartoon' },
                            { id: 'realistic', label: 'Realistic' },
                            { id: 'geometric', label: 'Geometric' }
                          ].map((style) => (
                            <button
                              key={style.id}
                              onClick={() => setSelectedStyle(style.id)}
                              className={`
                                px-4 py-2 rounded-full text-sm font-medium
                                transition-colors duration-200
                                ${selectedStyle === style.id
                                  ? 'bg-blue-100 text-blue-600 border-2 border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:border-gray-200'
                                }
                              `}
                            >
                              {style.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Generate Button - Full width on mobile */}
                      <button
                        onClick={handleGenerateClick}
                        disabled={generating || (!textPrompt && !uploadedFile)}
                        className="w-full py-3 px-4 bg-black text-white rounded-xl 
                          hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed
                          transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin text-white" />
                            <span className="text-white">Generating...</span>
                          </>
                        ) : (
                          <>
                            <Wand className="w-5 h-5 text-white" />
                            <span className="text-white">Generate Design</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    // Upload Section - Simplified
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 rounded-xl p-12 cursor-pointer hover:border-blue-500 transition-colors"
                    >
                      <div className="flex flex-col items-center gap-4">
                        <Upload className="w-8 h-8 text-gray-400" />
                        <div className="text-center">
                          <p className="text-gray-600">Drop your image here, or click to browse</p>
                          <p className="text-sm text-gray-500">Upload photos, sketches, or inspiration images</p>
                        </div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/png,image/jpeg,image/svg+xml"
                          className="hidden"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Design History */}
            <div className="bg-white border border-gray-200 hover:border-gray-300 rounded-2xl shadow-sm p-3 mt-12 transition-all">
              {/* Recent Designs Section */}
              <div className="bg-white rounded-lg">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h3 className="text-lg font-dm-sans font-medium text-gray-900">Recent Designs</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => clearDesigns()}
                      className="text-sm text-gray-500 hover:text-gray-700 font-dm-sans font-medium"
                    >
                      Clear All
                    </button>
                    {designs.length > 4 && (
                      <button
                        onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
                        className="text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1"
                      >
                        {isHistoryCollapsed ? (
                          <>Show All <ChevronDown className="w-4 h-4" /></>
                        ) : (
                          <>Collapse <ChevronUp className="w-4 h-4" /></>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Design Thumbnails */}
                <div className="p-3">
                  {designs.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 transition-all duration-200">
                      {(isHistoryCollapsed ? designs.slice(0, 4) : designs).map((design, index) => {
                        // Skip designs without images
                        if (!design?.images?.length) return null;
                        
                        return (
                          <div
                            key={design.id || index}
                            className="relative aspect-square group cursor-pointer bg-white border border-gray-200 hover:border-gray-300 rounded-xl transition-all"
                            onClick={() => {
                              setSelectedDesign(design.images[0]);
                              setShowAnalysis(true);
                              setScrollToAnalysis(true);
                            }}
                          >
                            <div className="relative w-full h-full">
                              <div className="absolute inset-0">
                                <img
                                  src={design.images[0]}
                                  alt={`Design ${index + 1}`}
                                  className={`w-full h-full object-cover rounded-xl ${
                                    selectedDesign === design.images[0] ? 'ring-2 ring-blue-500' : ''
                                  }`}
                                  onError={handleImageError(design.images[0])}
                                  onLoad={handleImageLoad(design.images[0])}
                                />
                              </div>
                              
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 rounded-xl">
                                <div className="absolute bottom-0 left-0 right-0 p-3 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(design.images[0]);
                                    }}
                                    className="p-2 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-gray-700 transition-all duration-200"
                                    aria-label="Download design"
                                  >
                                    <Download className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500 text-sm font-dm-sans font-medium">
                      No designs yet. Start by creating your first design above!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column Card */}
          <div className="lg:sticky lg:top-6 self-start w-full" ref={analysisRef}>
            <div className="bg-white border border-gray-200 hover:border-gray-300 backdrop-blur-sm rounded-2xl shadow-sm p-3 transition-all">
              {/* Header Section */}
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-2xl font-dm-sans font-medium text-gray-900">
                  Make With Taiyaki. 
                </h2>
                {selectedDesign && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-600 font-dm-sans font-medium">
                      {designs.find(d => d.images.includes(selectedDesign))?.title || 'Untitled Design'}
                    </span>
                    <span className="text-gray-500 font-inter">
                      {new Date(designs.find(d => d.images.includes(selectedDesign))?.createdAt || '').toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Content Section */}
              <div className="p-6">
                {selectedDesign ? (
                  <div className="space-y-8">
                    {/* Edit Button and Image Preview */}
                    <div className="space-y-3">
                      {/* Action buttons above the image */}
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleDownload(selectedDesign)}
                          className="py-2 px-4 bg-white border border-gray-200 hover:border-gray-300 
                            rounded-xl text-gray-700 transition-all duration-200 flex items-center gap-2 font-dm-sans font-medium"
                          aria-label="Download design"
                        >
                          <Download className="w-5 h-5" />
                          <span>Download</span>
                        </button>
                        <button
                          onClick={() => setShowEditDialog(true)}
                          className="py-2 px-4 bg-white border border-gray-200 hover:border-gray-300 
                            rounded-xl text-gray-700 transition-all duration-200 flex items-center gap-2 font-dm-sans font-medium"
                          aria-label="Edit design"
                        >
                          <Edit className="w-5 h-5" />
                          <span>Edit</span>
                        </button>
                      </div>

                      <div className="aspect-square rounded-2xl overflow-hidden relative">
                        <img
                          src={selectedDesign}
                          alt="Selected Design"
                          className="w-full h-full object-cover transition-opacity duration-300"
                          loading="eager"
                          decoding="async"
                          onLoadStart={(e) => e.currentTarget.style.opacity = '0.5'}
                          onLoad={(e) => e.currentTarget.style.opacity = '1'}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-4 mt-6">
                      <div className="flex gap-4">
                        {/* Primary "Get it Made" button */}
                        <Link 
                          href={`/get-it-made?designId=${designs.find(d => d.images.includes(selectedDesign))?.id}`}
                          className="flex-1 py-3 px-4 bg-black text-white rounded-xl hover:opacity-90 
                            transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          <Hammer className="w-5 h-5 text-white" />
                          <span className="text-white">Get it Made</span>
                        </Link>

                        {/* 3D Preview Button/Status */}
                        {selectedDesign && designs.find(d => d.images.includes(selectedDesign))?.threeDData?.videoUrl ? (
                          <div
                            className="flex-1 py-3 px-4 bg-gray-100 text-gray-600
                              rounded-xl font-medium flex items-center justify-center gap-2"
                          >
                            <Box className="w-5 h-5" />
                            <span>3D Preview Generated</span>
                          </div>
                        ) : (
                          <button
                            onClick={handle3DProcessing}
                            disabled={processing3D}
                            className="flex-1 py-3 px-4 bg-white border border-gray-200 hover:border-gray-300 
                              rounded-xl text-gray-700 font-medium flex items-center justify-center gap-2 
                              transition-all duration-200 disabled:opacity-50"
                          >
                            {processing3D ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Processing...</span>
                              </>
                            ) : (
                              <>
                                <Box className="w-5 h-5" />
                                <span>Show in 3D</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {showProcessingCard && (
                        <div className="p-4 rounded-xl bg-gray-50">
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

                    {/* 3D Preview - Shown when available */}
                    {selectedDesign && (
                      <div className="mt-6">
                        {(() => {
                          const currentDesign = designs.find(d => d.images.includes(selectedDesign));
                          const threeDVideo = currentDesign?.threeDData?.videoUrl;
                          
                          return threeDVideo ? (
                            <div>
                              <div className="overflow-hidden rounded-xl border border-gray-200">
                                <video
                                  key={threeDVideo}
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  controls
                                  className="w-full h-full object-cover"
                                >
                                  <source src={threeDVideo} type="video/mp4" />
                                  Your browser does not support the video tag.
                                </video>
                              </div>
                              <p className="text-sm text-gray-500 mt-2 italic">
                                Note: This is an AI-generated preview. The actual 3D model will be professionally optimized for manufacturing with cleaner geometry and proper dimensions.
                              </p>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Image 
                      src="/images/taiyaki.svg"
                      alt="Taiyaki Logo"
                      width={64}
                      height={64}
                      className="w-16 h-16 text-gray-400 mb-4 [filter:grayscale(100%)_opacity(40%)]"
                      priority
                    />
                    <p className="font-dm-sans font-medium text-gray-900 mb-2">
                      Upload a design or generate one to get started
                    </p>
                    <p className="font-inter font-normal text-gray-600">
                      Let's make your dreams a reality
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEditDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-3 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Design</h3>
              <button
                onClick={() => setShowEditDialog(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Design Preview */}
            <div className="mb-4">
              <img
                src={selectedDesign || ''}
                alt="Current Design"
                className="w-full h-48 object-contain rounded-xl bg-gray-50"
              />
            </div>

            {/* Edit Instructions */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe your changes
              </label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="Describe how you want to modify this design..."
                className="w-full p-3 border rounded-xl h-32 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEditDialog(false)}
                className="py-3 px-4 bg-white border border-gray-200 hover:border-gray-300 
                  rounded-xl text-gray-700 font-medium flex items-center gap-2 
                  transition-all duration-200"
              >
                <span>Cancel</span>
              </button>
              <button
                onClick={handleEditDesign}
                disabled={isEditing || !editPrompt}
                className="py-3 px-4 bg-black text-white rounded-xl hover:opacity-90 
                  disabled:opacity-50 flex items-center gap-2 transition-all duration-200"
              >
                {isEditing ? (
                  <>
                    <RefreshCw className="w-5 h-5 text-white animate-spin" />
                    <span className="text-white">Updating...</span>
                  </>
                ) : (
                  <>
                    <PenTool className="w-5 h-5 text-white" />
                    <span className="text-white">Update Design</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}