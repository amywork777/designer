'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Wand, Upload, PenTool, Type, Download, Cog, Clock, ChevronRight, Edit, Loader2, History, X, FileText, Info, Package, Palette, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
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

interface Design {
  id: string;
  imageUrl: string;
  date: string;
  name: string;
  manufacturingOption?: {
    name: string;
    description: string;
    setup: string;
    perUnit: string;
    leadTime: string;
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
  length: number;
  width: number;
  height: number;
  unit: 'mm' | 'inches';
}

// Add this interface for tracking image states
interface ImageState {
  loading: boolean;
  error: boolean;
}

const MATERIAL_OPTIONS = [
  {
    title: "Standard PLA",
    description: "Durable everyday plastic, great for most designs",
    cost: "$ (Most Affordable)",
    color: "Available in many colors"
  },
  {
    title: "Premium PETG",
    description: "Stronger and more durable than PLA",
    cost: "$$ (Mid-Range)",
    color: "Transparent or solid colors"
  },
  {
    title: "Professional Resin",
    description: "Smooth finish with fine details",
    cost: "$$$ (Premium)",
    color: "Various premium finishes"
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

export default function LandingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [inputMethod, setInputMethod] = useState<InputMethod>('text');
  const [textPrompt, setTextPrompt] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { designs, addDesign, clearDesigns, updateDesign, getUserDesigns } = useDesignStore();
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
  const userDesigns = session?.user?.id 
    ? getUserDesigns(session.user.id) 
    : getUserDesigns('anonymous'); // Get anonymous designs if not logged in
  const [imageStates, setImageStates] = useState<Record<string, ImageState>>({});
  const [hasUsedFreeDesign, setHasUsedFreeDesign] = useState(false);
  const [dimensions, setDimensions] = useState<Dimensions>({
    length: 0,
    width: 0,
    height: 0,
    unit: 'mm'
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
  const [is3DView, setIs3DView] = useState(false);

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
    if (dimensions.length <= 0 || dimensions.width <= 0 || dimensions.height <= 0) {
      setDimensionsError('Please enter valid dimensions');
      return false;
    }
    
    const maxSize = dimensions.unit === 'mm' ? 300 : 12; // 300mm or 12 inches
    if (dimensions.length > maxSize || dimensions.width > maxSize || dimensions.height > maxSize) {
      setDimensionsError(`Dimensions must not exceed ${maxSize}${dimensions.unit}`);
      return false;
    }

    setDimensionsError(null);
    return true;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      if (inspirationImages.length + files.length > MAX_INSPIRATION_IMAGES) {
        toast({
          variant: "destructive",
          title: "Error",
          description: `You can only upload up to ${MAX_INSPIRATION_IMAGES} inspiration images`
        });
        return;
      }

      try {
        const newImages = await Promise.all(
          files.map(async (file) => {
            const base64Image = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  resolve(reader.result);
                }
              };
              reader.readAsDataURL(file);
            });
            return base64Image;
          })
        );

        // Add each image to the designs store
        for (const imageUrl of newImages) {
          const newDesign = {
            title: 'Uploaded Design',
            images: [imageUrl],
            prompt: '',
            analysis: {
              productDescription: '',
              dimensions: '',
              manufacturingOptions: [],
              status: 'pending'
            }
          };
          
          // Add to store with user ID
          const userId = session?.user?.id || 'anonymous';
          addDesign(newDesign, userId);
        }

        setInspirationImages(prev => [...prev, ...newImages]);
        setSelectedDesign(newImages[0]); // Set first image as selected
        
        toast({
          title: "Success",
          description: "Images uploaded successfully!"
        });
      } catch (error) {
        console.error('Error processing images:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to process images. Please try again."
        });
      }
    }
  };

  const handleGenerateWithImage = async (file: File) => {
    try {
      const processedDataUrl = await preprocessImage(file);
      setImagePreview(processedDataUrl);
      
      // This will be used as reference for AI generation
      const response = await fetch('/api/generateImage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: textPrompt,
          referenceImage: processedDataUrl
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Set the generated image as selected design
      setSelectedDesign(data.images[0]);
      
      // Add to design store
      const newDesign = {
        id: Date.now().toString(),
        title: generateDesignTitle(textPrompt),
        images: data.images,
        createdAt: new Date().toISOString()
      };
      addDesign(newDesign);

      toast({
        title: "Success",
        description: "New design generated! Scroll down to see manufacturing options."
      });
    } catch (error) {
      console.error('Error generating design:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate design. Please try again."
      });
    }
  };

  const getPromptForMethod = async () => {
    if (inputMethod === 'text') {
      return { prompt: BASE_SETTINGS + textPrompt };
    }

    if (!uploadedFile || !imagePreview) {
      throw new Error('Please upload an image first');
    }

    try {
      // First analyze the uploaded image
      const visionResponse = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: imagePreview,
          additionalDetails: textPrompt 
        }),
      });

      const visionData = await visionResponse.json();

      if (!visionResponse.ok || !visionData.success) {
        throw new Error(visionData.error || 'Failed to analyze image');
      }

      // Save the reference image
      referenceImage = imagePreview;
      
      // Create prompt combining vision analysis and user modifications
      basePrompt = `${BASE_SETTINGS} Based on this reference image showing ${visionData.description}. ${
        textPrompt ? `Modify it by: ${textPrompt}` : 'Enhance the design while maintaining its core features.'
      }`;

    } catch (error) {
      console.error('Image analysis failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze image. Please try again."
      });
      setGenerating(false);
      return;
    }
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

  const handleGenerateDesign = async () => {
    if (hasUsedFreeDesign && !session?.user?.id) {
      const result = await signIn("google", { 
        redirect: false,
        callbackUrl: window.location.href 
      });
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      let payload;

      if (inputMethod === 'text') {
        if (!textPrompt.trim()) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Please enter a text description"
          });
          return;
        }
        
        payload = {
          prompt: textPrompt.trim(),
          mode: 'generate',
          style: selectedStyle
        };
      } else if (inputMethod === 'upload') {
        if (!inspirationImages.length) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Please upload at least one image"
          });
          return;
        }

        // First analyze the image with GPT-4 Vision
        const visionResponse = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: inspirationImages[0]
          })
        });

        if (!visionResponse.ok) {
          throw new Error('Failed to analyze image');
        }

        const visionData = await visionResponse.json();
        
        if (!visionData.success) {
          throw new Error(visionData.error || 'Failed to analyze image');
        }

        // Show analysis to user
        toast({
          title: "Analysis Complete",
          description: "Creating your design based on the analysis..."
        });

        // Create generation payload using the analysis
        payload = {
          prompt: textPrompt.trim(),
          mode: 'edit',
          visionAnalysis: visionData,
          style: selectedStyle
        };
      }

      // Generate the image
      const response = await fetch('/api/generateImage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate image');
      }

      const data = await response.json();

      if (!data.imageUrl) {
        throw new Error('No image URL in response');
      }

      // Create new design with the analysis data
      const newDesign = {
        id: Date.now().toString(),
        title: generateDesignTitle(textPrompt || 'New Design'),
        images: [data.imageUrl],
        createdAt: new Date().toISOString(),
        analysis: {
          productDescription: textPrompt || '',
          dimensions: '',
          manufacturingOptions: [],
          ...(payload.visionAnalysis?.attributes || {})
        }
      };

      // Add the design to the store with the user ID
      const userId = session?.user?.id || 'anonymous';
      addDesign(newDesign, userId);
      
      setSelectedDesign(data.imageUrl);
      setShowAnalysis(true);

      toast({
        title: "Success",
        description: "Design generated successfully!"
      });

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

  const handleDownload = async (imageUrl: string) => {
    try {
      const response = await fetch('/api/download-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl })
      });

      if (!response.ok) {
        throw new Error('Failed to download image');
      }

      // Get the blob from the response
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

  const handleEditDesign = async () => {
    if (!selectedDesign || !editPrompt) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide edit instructions"
      });
      return;
    }

    try {
      setIsEditing(true);

      // Convert image URL to base64 if needed
      let imageData = selectedDesign;
      if (selectedDesign.startsWith('data:')) {
        // Already base64, use as is
        imageData = selectedDesign;
      } else if (selectedDesign.startsWith('blob:')) {
        // Convert blob URL to base64
        const response = await fetch(selectedDesign);
        const blob = await response.blob();
        imageData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            }
          };
          reader.readAsDataURL(blob);
        });
      } else {
        // Regular URL, fetch and convert to base64
        const response = await fetch(selectedDesign);
        const blob = await response.blob();
        imageData = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            }
          };
          reader.readAsDataURL(blob);
        });
      }

      // First analyze the current image with GPT-4 Vision
      const visionResponse = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageData
        })
      });

      if (!visionResponse.ok) {
        const errorData = await visionResponse.json();
        throw new Error(errorData.error || 'Failed to analyze image');
      }

      const visionData = await visionResponse.json();
      
      if (!visionData.success) {
        throw new Error(visionData.error || 'Failed to analyze image');
      }

      // Find or create the design in the store
      let currentDesign = designs.find(d => d.images.includes(selectedDesign));
      
      if (!currentDesign) {
        // If the design isn't in the store yet, create it
        const newDesign = {
          id: Date.now().toString(),
          title: 'Uploaded Design',
          images: [selectedDesign],
          prompt: editPrompt,
          analysis: {
            productDescription: '',
            dimensions: '',
            manufacturingOptions: [],
            status: 'pending'
          }
        };
        
        const userId = session?.user?.id || 'anonymous';
        addDesign(newDesign, userId);
        currentDesign = designs.find(d => d.images.includes(selectedDesign));
        
        if (!currentDesign) {
          throw new Error('Failed to create design record');
        }
      }

      // Generate the new image using the analysis and edit prompt
      const payload = {
        prompt: editPrompt,
        mode: 'edit',
        visionAnalysis: visionData,
        style: selectedStyle
      };

      const response = await fetch('/api/generateImage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate new design');
      }

      const data = await response.json();

      if (!data.success || !data.imageUrl) {
        throw new Error('No image URL in response');
      }

      // Update the design with the new image and analysis
      updateDesign(currentDesign.id, {
        images: [...currentDesign.images, data.imageUrl],
        analysis: {
          ...currentDesign.analysis,
          productDescription: visionData.description || '',
          status: 'analyzed'
        }
      });
      
      setSelectedDesign(data.imageUrl);
      setShowEditDialog(false);
      setEditPrompt('');

      toast({
        title: "Success",
        description: "Design updated successfully"
      });

    } catch (error) {
      console.error('Edit failed:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update design"
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
          setSelectedMaterials(prev => ({
            ...prev,
            [recommendedMethod]: recommendedMaterials[0]
          }));
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
    if (!selectedMethod || !selectedMaterials[selectedMethod]) {
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
        material: selectedMaterials[selectedMethod],
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
          setSelectedMaterials({
            ...selectedMaterials,
            [recommendedMethod]: recommendedMaterials[0]
          });
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

  // Update the useEffect to handle material recommendations too
  useEffect(() => {
    if (selectedDesign && designs.find(d => d.images.includes(selectedDesign))?.analysis) {
      const design = designs.find(d => d.images.includes(selectedDesign));
      const newRecommendedMethod = getRecommendedMethod(quantity, design?.analysis?.description);
      const newRecommendedMaterials = getRecommendedMaterials(quantity, design?.analysis?.description);
      
      setSelectedMethod(newRecommendedMethod);
      
      // Auto-select the first recommended material
      if (newRecommendedMaterials.length > 0) {
        setSelectedMaterials(prev => ({
          ...prev,
          [newRecommendedMethod]: newRecommendedMaterials[0]
        }));
      }
      
      // Update the UI for manufacturing methods
      MANUFACTURING_METHODS.forEach(m => {
        m.recommended = m.title === newRecommendedMethod;
      });
    }
  }, [quantity, selectedDesign]);

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
          setSelectedMaterials(prev => ({
            ...prev,
            [data.recommendedMethod]: data.recommendedMaterials[0]
          }));
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

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-12">
          <div className="flex items-center justify-between">
            <h1 className={headingStyles.h1}>
              Manufacturing AI Assistant
            </h1>
            
            {/* Add auth button */}
            {session ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {session.user?.image && (
                    <Image
                      src={session.user.image}
                      alt="Profile"
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  )}
                  <span className="text-black">{session.user?.name}</span>
                </div>
                <button
                  onClick={() => signIn("google")}
                  className="px-4 py-2 text-black hover:text-gray-900"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Image
                  src="/google.svg"
                  alt="Google"
                  width={20}
                  height={20}
                />
                <span className="text-black">Sign in with Google</span>
              </button>
            )}
          </div>
        </div>

        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Info className="w-5 h-5 text-blue-600" />
              <h2 className={headingStyles.h2}>
                How It Works
              </h2>
            </div>

            {/* Progress Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PROGRESS_STEPS.map((step, index) => (
                <div key={step.id} className="relative">
                  {/* Step Card */}
                  <div className="bg-blue-50 rounded-xl p-6 h-full">
                    {/* Step Number */}
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                      <span className="text-blue-600 font-semibold">{step.id}</span>
                    </div>
                    
                    {/* Icon and Title */}
                    <div className="flex items-center gap-3 mb-3">
                      <step.icon className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">{step.name}</h3>
                    </div>
                    
                    {/* Description */}
                    <p className="text-gray-600 text-sm">{step.description}</p>
                  </div>

                  {/* Connector Line (except for last item) */}
                  {index < PROGRESS_STEPS.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-blue-200" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Generation Form */}
          <div>
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-8">
              {/* Tab Selection */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setInputMethod('text')}
                  className={`flex-1 py-3 px-4 rounded-lg text-center ${
                    inputMethod === 'text'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  Generate New Idea
                </button>
                <button
                  onClick={() => setInputMethod('upload')}
                  className={`flex-1 py-3 px-4 rounded-lg text-center ${
                    inputMethod === 'upload'
                      ? 'bg-blue-100 text-blue-500'
                      : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  Upload Existing Idea
                </button>
              </div>

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
                        className="w-full h-32 px-4 py-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400"
                      />
                    </div>

                    {/* Reference Image Upload */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Upload className="w-4 h-4" />
                        <span>Add reference image (optional)</span>
                      </div>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 rounded-lg p-8 cursor-pointer hover:border-blue-500 transition-colors text-center"
                      >
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">Drop a reference image, or click to browse</p>
                        <p className="text-sm text-gray-500">Helps us better understand your vision</p>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/png,image/jpeg,image/svg+xml"
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Style Selection */}
                    <div className="space-y-2">
                      <span className="text-gray-700">Style (Optional)</span>
                      <div className="flex gap-2">
                        {STYLE_OPTIONS.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                            className={`px-4 py-2 rounded-full ${
                              selectedStyle === style.id
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {style.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={handleGenerateDesign}
                      disabled={generating || (!textPrompt.trim() && !uploadedFile)}
                      className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                        disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Generate Design
                    </button>
                  </div>
                ) : (
                  // Upload Section - Simplified
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-lg p-12 cursor-pointer hover:border-blue-500 transition-colors"
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

            {/* Design History */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-black">Recent Designs</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear all design history?')) {
                        clearDesigns();
                        setSelectedDesign(null);
                        setShowAnalysis(false);
                      }
                    }}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-700"
                  >
                    Clear History
                  </button>
                  <button
                    onClick={() => setIsHistoryCollapsed(!isHistoryCollapsed)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    {isHistoryCollapsed ? (
                      <>
                        Show All <ChevronDown className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Collapse <ChevronUp className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {userDesigns.length > 0 ? (
                  // Show either 2 or all designs based on collapsed state
                  userDesigns
                    .slice(0, isHistoryCollapsed ? 2 : undefined)
                    .map((design) => (
                      <div 
                        key={design.id} 
                        className="bg-white rounded-lg shadow-sm p-4"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          {/* Images Grid */}
                          <div className="grid grid-cols-2 gap-2">
                            {design.images.map((imageUrl, index) => (
                              <div
                                key={`${design.id}-${index}`}
                                className={`aspect-square rounded-lg overflow-hidden cursor-pointer relative group 
                                  ${selectedDesign === imageUrl ? 'ring-2 ring-blue-500' : ''}`}
                                onClick={() => {
                                  setSelectedDesign(imageUrl);
                                  setShowAnalysis(true);
                                }}
                              >
                                <div className="relative w-full h-full">
                                  <img
                                    src={imageUrl}
                                    alt={`Design ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(imageUrl);
                                      }}
                                      className="p-2 bg-white rounded-full hover:bg-gray-100"
                                    >
                                      <Download className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Design Info */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2 text-black">
                                <Clock className="w-4 h-4 text-black" />
                                <time dateTime={design.createdAt}>
                                  {new Date(design.createdAt).toLocaleDateString('en-US')}
                                </time>
                              </div>
                              <div className="truncate max-w-[60%] text-black font-medium">
                                {design.title || 'Untitled Design'}
                              </div>
                            </div>
                            {design.analysis && (
                              <div className="text-sm text-gray-600 mt-2">
                                <p className="line-clamp-2">{design.analysis.description}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-8 text-black">
                    <p>No designs generated yet. Start by creating your first design above!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Size Limits & Guidelines Card */}
            <div className="bg-white rounded-lg shadow-sm p-6 mt-8">
              <h3 className="text-xl font-bold text-gray-700 mb-6 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                Size Ranges & Creative Guidelines
              </h3>

              <div className="space-y-8">
                {/* Size Ranges Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-3">
                    Available Size Ranges
                  </h4>
                  <div className="space-y-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="font-medium text-gray-700">Miniature</p>
                      <p className="text-gray-600">About the size of a golf ball</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="font-medium text-gray-700">Desktop</p>
                      <p className="text-gray-600">About the size of a coffee mug</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="font-medium text-gray-700">Large Format</p>
                      <p className="text-gray-600">About the size of a basketball</p>
                    </div>
                  </div>
                </div>

                {/* Perfect For Section */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-3">
                    Perfect For
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">✨ Art pieces</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">🎭 Character designs</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">🏺 Display items</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">🌊 Organic shapes</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700">🗿 Sculptural pieces</p>
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">
                    Good to Know
                  </h4>
                  <ul className="space-y-2 text-gray-600">
                    <li>• This is great for artistic and decorative items!</li>
                    <li>• Best for items where exact measurements aren't crucial</li>
                    <li>• Sizes are approximate and may vary slightly</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Manufacturing Analysis */}
          <div className="lg:sticky lg:top-6 self-start">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Bring Your Idea to Life
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${is3DView ? 'text-gray-400' : 'text-gray-700 font-medium'}`}>2D</span>
                  <button
                    onClick={() => setIs3DView(!is3DView)}
                    className="w-12 h-6 rounded-full relative bg-gray-200 transition-colors duration-200 ease-in-out"
                  >
                    <div
                      className={`absolute w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ease-in-out ${
                        is3DView ? 'translate-x-6' : 'translate-x-1'
                      } top-0.5`}
                    />
                  </button>
                  <span className={`text-sm ${is3DView ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>3D</span>
                </div>
              </div>

              {/* Selected Design Preview */}
              {selectedDesign ? (
                <div className="space-y-6">
                  {/* Image/3D Preview */}
                  <div className="aspect-square rounded-lg overflow-hidden relative group">
                    {is3DView ? (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <p className="text-gray-500">3D view coming soon...</p>
                      </div>
                    ) : (
                      <img
                        src={selectedDesign}
                        alt="Selected Design"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => setShowEditDialog(true)}
                        className="px-4 py-2 bg-white rounded-lg hover:bg-gray-100 text-black font-medium flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit Design
                      </button>
                    </div>
                  </div>

                  {/* Manufacturing Analysis Component */}
                  <ManufacturingAnalysis
                    imageUrl={selectedDesign}
                    existingAnalysis={designs.find(d => d.images.includes(selectedDesign))?.analysis}
                    onAnalysisComplete={handleAnalysisComplete}
                    onRedoAnalysis={handleRedoAnalysis}
                    quantity={quantity}
                    onQuantityChange={setQuantity}
                    dimensions={dimensions}
                    onDimensionsChange={setDimensions}
                    isRedoing={isAnalyzing}
                    designComments={designComments}
                    onCommentsChange={setDesignComments}
                  />

                  {/* Material Selection */}
                  <div className="space-y-4">
                    <h3 className={headingStyles.h2}>
                      Select Material
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {MATERIAL_OPTIONS.map((material) => (
                        <div
                          key={material.title}
                          className={`p-4 rounded-lg border transition-all ${
                            selectedMethod === material.title
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-blue-300'
                          }`}
                          onClick={() => setSelectedMethod(material.title)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className={headingStyles.h4}>{material.title}</h4>
                              <p className={textStyles.secondary}>{material.description}</p>
                              <div className="mt-2 space-y-1">
                                <p className="text-sm font-medium text-gray-700">{material.cost}</p>
                                <p className="text-sm text-gray-600">{material.color}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button
                    onClick={handleGenerateManufacturingPlan}
                    disabled={!selectedMethod || isUpdatingPlan}
                    className="w-full mt-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 
                      text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isUpdatingPlan ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Package className="w-5 h-5" />
                        Proceed to Checkout
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="w-12 h-12 text-gray-400 mb-4" />
                  <p className={`${textStyles.primary} mb-2`}>
                    Upload a design or generate one to get started
                  </p>
                  <p className={textStyles.secondary}>
                    Your manufacturing options will appear here
                  </p>
                </div>
              )}
            </div>

            {/* Add version history dialog */}
            {showVersionHistory && selectedDesign && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className={headingStyles.h2}>Design History</h3>
                    <button
                      onClick={() => setShowVersionHistory(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {designs.find(d => d.images.includes(selectedDesign))
                      ?.imageVersions[selectedDesign]?.history.map((version, index) => (
                      <div key={index} className="space-y-2">
                        <div className="aspect-square rounded-lg overflow-hidden relative group">
                          <img
                            src={version}
                            alt={`Version ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleRevertToVersion(selectedDesign, version)}
                              className="px-3 py-1 bg-white rounded-lg hover:bg-gray-100 text-sm"
                            >
                              Revert to This
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-black">
                          Version {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Edit Dialog */}
            {showEditDialog && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">Edit Design</h3>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="Describe how you want to modify this 3D character model..."
                    className="w-full p-2 border rounded-lg mb-4 h-32 text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowEditDialog(false)}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEditDesign}
                      disabled={isEditing || !editPrompt}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 font-medium"
                    >
                      {isEditing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <PenTool className="w-4 h-4" />
                          Update Design
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}