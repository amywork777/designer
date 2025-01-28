'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Wand, Upload, PenTool, Type, Download, Cog, Clock, ChevronRight, Edit, Loader2, History, X, FileText, Info, Package, Palette, RefreshCw, ChevronDown, ChevronUp, Check, Lock, Box } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import imageCompression from 'browser-image-compression';
import { useDesignStore } from '@/lib/store/designs';
import { ManufacturingAnalysis } from '@/components/ManufacturingAnalysis';
import Link from 'next/link';
import { put } from '@vercel/blob';
import { AnalysisData } from '@/types/analysis';
import { useSession } from "next-auth/react";
import { signIn } from "next-auth/react";
import { ManufacturingRecommendations } from '@/components/ManufacturingRecommendations';
import { DesignFeeSection } from '@/components/DesignFeeSection';
import { SIZES } from '@/lib/types/sizes';
import { saveDesignToFirebase } from '@/lib/firebase/utils';
import { MATERIAL_OPTIONS } from '@/lib/constants/materials';
import { process3DPreview } from "@/lib/firebase/utils";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Suspense } from 'react';

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
  if (!designPrompt) {
    toast({
      variant: "destructive",
      title: "Error",
      description: "Please enter a design prompt"
    });
    return;
  }

  setGeneratingDesign(true);
  try {
    // Build complete prompt including styles and reference image
    let fullPrompt = designPrompt;

    // Add selected styles if any
    if (selectedStyles && selectedStyles.length > 0) {
      fullPrompt += ` Style: ${selectedStyles.join(', ')}. `;
    }

    // Add reference image analysis if exists
    if (inspirationImages.length > 0) {
      const response = await fetch('/api/analyze-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: inspirationImages[0],
          mode: 'reference'
        })
      });

      if (response.ok) {
        const { description } = await response.json();
        fullPrompt = `Reference image shows: ${description}. Please create a design that: ${fullPrompt}`;
      }
    }

    console.log('Sending complete prompt:', fullPrompt);

    const response = await fetch('/api/generate-design', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        style: selectedStyles[0],
        userId: session?.user?.id || 'anonymous',
        n: 1,
        size: "1024x1024"
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate design');
    }

    const data = await response.json();
    
    if (!data.success || !data.images?.[0]) {
      throw new Error('No image generated');
    }

    // Update the editor state with the new image
    setEditorState(prev => ({
      ...prev!,
      imageUrl: data.images[0],
      originalPrompt: fullPrompt
    }));

    toast({
      title: "Success",
      description: "Design generated successfully"
    });

  } catch (error) {
    console.error('Error generating design:', error);
    toast({
      variant: "destructive",
      title: "Error",
      description: error instanceof Error ? error.message : 'Failed to generate design'
    });
  } finally {
    setGeneratingDesign(false);
  }
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

// Add this helper function near other utility functions
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
    <div className="aspect-square bg-gray-200 rounded-lg mb-4" />
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

export default function SelectDesign() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading design tools...</p>
        </div>
      </div>
    }>
      {/* Keep all existing JSX and functionality */}
      // ... existing component content ...
    </Suspense>
  );
}