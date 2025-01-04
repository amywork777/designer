'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Wand, Link, Eraser, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from "@/components/ui/use-toast";

interface EditorState {
  imageUrl: string;
  originalPrompt: string;
  viewType: string;
  sessionId: string;
}

interface EditorProps {
  initialImage?: string | null;
}

export default function ImageEditor({ initialImage }: EditorProps) {
  const params = useParams();
  const { toast } = useToast();
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [showBackgroundPrompt, setShowBackgroundPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productType, setProductType] = useState<string>('product');
  const [generatingDesign, setGeneratingDesign] = useState(false);
  const [designPrompt, setDesignPrompt] = useState('');

  // Get image URL from query parameters
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const imageFromUrl = urlParams.get('image');
      if (imageFromUrl) {
        const decodedUrl = decodeURIComponent(imageFromUrl);

        // Validate URL format
        try {
          new URL(decodedUrl);
        } catch (e) {
          setError('Invalid image URL provided');
          return;
        }

        // Analyze the image
        const analyzeImage = async () => {
          try {
            const response = await fetch('/api/analyze-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                imageUrl: decodedUrl,
                prompt: 'What type of product is this?'
              })
            });

            const data = await response.json();

            if (!data.success) {
              throw new Error(data.error || 'Failed to analyze image');
            }

            if (data.analysis) {
              setProductType(data.analysis.toLowerCase());
            }
          } catch (error) {
            console.error('Error analyzing image:', error);
            // Don't set error state as it's not critical
          }
        };

        analyzeImage();

        setEditorState({
          imageUrl: decodedUrl,
          originalPrompt: 'Image for editing',
          viewType: 'edit',
          sessionId: params.id as string
        });
        setLoading(false);
      } else {
        setError('No image URL provided');
      }
    }
  }, [params.id]);

  const handleSave = async () => {
    if (!editorState?.imageUrl) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No image to edit"
      });
      return;
    }

    try {
      // Apply background changes
      toast({
        title: "Success",
        description: "Changes applied successfully"
      });

    } catch (error) {
      console.error('Error applying changes:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to apply changes'
      });
    }
  };

  const handleConfirmDesign = async () => {
    setIsConfirming(true);
    try {
      if (!editorState?.imageUrl) {
        throw new Error('No image to confirm');
      }

      // Save the design to the marketplace
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: editorState.imageUrl,
          productType,
          originalPrompt: editorState.originalPrompt,
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to save design');
      }

      if (!data.productId) {
        throw new Error('No product ID received');
      }

      toast({
        title: "Success",
        description: "Design saved successfully",
      });

      // Wait a moment for the toast to show before redirecting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Redirect to the confirmation page
      window.location.href = `/design/confirm/${data.productId}`;

    } catch (error) {
      console.error('Error confirming design:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to confirm design'
      });
    } finally {
      setIsConfirming(false);
    }
  };

  // Clean up blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (editorState?.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(editorState.imageUrl);
      }
    };
  }, []);

  // Add an effect to handle image loading
  useEffect(() => {
    if (!editorState?.imageUrl) return;

    const validateImage = async () => {
      try {
        const img = new Image();
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            console.log('Image validated successfully:', {
              width: img.width,
              height: img.height,
              src: img.src.substring(0, 100) + '...'
            });
            resolve(img);
          };
          img.onerror = (e) => {
            reject(new Error('Failed to validate image'));
          };

          if (editorState.imageUrl.startsWith('data:')) {
            img.src = editorState.imageUrl;
          } else {
            fetch('/api/proxy-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl: editorState.imageUrl })
            })
            .then(response => {
              if (!response.ok) throw new Error('Failed to fetch image from proxy');
              return response.blob();
            })
            .then(blob => {
              img.src = URL.createObjectURL(blob);
            })
            .catch(error => {
              reject(new Error(`Failed to load image through proxy: ${error.message}`));
            });
          }
        });
      } catch (error) {
        console.error('Error loading image:', error);
        setError(error instanceof Error ? error.message : 'Failed to load the image');
      }
    };

    validateImage();
  }, [editorState?.imageUrl]);

  const handleRemoveBackground = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: editorState?.imageUrl })
      });

      if (!response.ok) throw new Error('Failed to remove background');
      
      const data = await response.json();
      setEditorState(prev => ({
        ...prev!,
        imageUrl: data.imageUrl
      }));

      toast({
        title: "Success",
        description: "Background removed successfully"
      });
    } catch (error) {
      console.error('Error removing background:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove background"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateBackground = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/generate-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: editorState?.imageUrl,
          prompt: backgroundPrompt
        })
      });

      if (!response.ok) throw new Error('Failed to generate background');
      
      const data = await response.json();
      setEditorState(prev => ({
        ...prev!,
        imageUrl: data.imageUrl
      }));

      toast({
        title: "Success",
        description: "Background generated successfully"
      });
    } catch (error) {
      console.error('Error generating background:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate background"
      });
    } finally {
      setIsProcessing(false);
      setShowBackgroundPrompt(false);
    }
  };

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
      const response = await fetch('/api/generate-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: designPrompt,
          n: 1,
          size: "1024x1024"
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate design');
      }

      const data = await response.json();
      
      if (!data.success || !data.images?.[0]) {
        throw new Error('No image generated');
      }

      // Update the editor state with the new image
      setEditorState(prev => ({
        ...prev!,
        imageUrl: data.images[0],
        originalPrompt: designPrompt
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header with buttons */}
        <div className="flex justify-between items-center bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit Design</h1>
            <p className="text-gray-600">Select an area and adjust its properties</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleConfirmDesign}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              disabled={loading || isConfirming}
            >
              <Check className="w-4 h-4" />
              {isConfirming ? 'Confirming...' : 'Confirm Design'}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {(loading || isConfirming) && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
              <div className="flex justify-center mb-6">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.7, 1, 0.7],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <Sparkles className="w-12 h-12 text-blue-500" />
                </motion.div>
              </div>
              <p className="text-center text-gray-900 font-medium">
                {loading ? 'Processing your changes...' : 'Confirming your design...'}
              </p>
              <p className="text-center text-gray-600 text-sm mt-2">This may take a few moments</p>
            </div>
          </div>
        )}

        {/* Tools Panel */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={handleRemoveBackground}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg flex items-center gap-2 bg-red-500 text-white hover:bg-red-600"
              >
                <Eraser className="w-4 h-4" />
                Remove Background
              </button>
              
              <button
                onClick={() => setShowBackgroundPrompt(true)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600"
              >
                <Wand className="w-4 h-4" />
                Generate Background
              </button>
            </div>
          </div>

          {/* Background prompt input */}
          {showBackgroundPrompt && (
            <div className="mt-4 p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-blue-100">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={backgroundPrompt}
                  onChange={(e) => setBackgroundPrompt(e.target.value)}
                  placeholder="Describe the background you want (e.g., 'minimal white studio', 'nature scene')"
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
                <button
                  onClick={handleGenerateBackground}
                  disabled={isProcessing || !backgroundPrompt}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Generate
                </button>
              </div>
            </div>
          )}

          <div className="mb-4 p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-purple-100">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={designPrompt}
                onChange={(e) => setDesignPrompt(e.target.value)}
                placeholder="Describe the design you want to generate..."
                className="flex-1 px-4 py-2 border rounded-lg"
              />
              <button
                onClick={handleGenerateDesign}
                disabled={generatingDesign || !designPrompt}
                className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
              >
                {generatingDesign ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-4 h-4" />
                    </motion.div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand className="w-4 h-4" />
                    Generate Design
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {/* Canvas */}
        <div className="relative aspect-square w-full bg-white/90 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden">
          {editorState?.imageUrl && (
            <img
              src={editorState.imageUrl}
              alt="Design to edit"
              className="w-full h-full object-contain"
            />
          )}
        </div>

        {/* Quick Help Tooltip */}
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-2">How to use:</p>
              <ol className="list-decimal pl-4 space-y-1 text-gray-900">
                <li>Click "Remove Background" to remove the current background</li>
                <li>Click "Generate Background" to create a new background</li>
                <li>Enter a description for your desired background</li>
                <li>Click "Confirm Design" when finished</li>
              </ol>
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 mb-2">Tips:</p>
              <ul className="list-disc pl-4 space-y-1 text-gray-900">
                <li>Be specific in your background descriptions</li>
                <li>Try different background styles</li>
                <li>Make sure your subject is clearly visible</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 