import React, { useState, useCallback } from 'react';
import LoadingAnimation from './LoadingAnimation';
import { MessageSquare, PenTool, Camera, X, Save, Sparkles, Check, Trash2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { productStore } from '@/lib/store/products';

interface GeneratedImage {
  id: string;
  url: string;
  viewType: string;
  prompt: string;
  actions: {
    edit: boolean;
    confirm: boolean;
  };
}

interface ImageGeneratorProps {
  onImagesGenerated?: (images: GeneratedImage[]) => void;
}

type TabType = 'describe' | 'sketch' | 'photo';

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onImagesGenerated }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('describe');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  // Example prompts that rotate
  const examplePrompts = [
    "A modular desk organizer with wireless charging",
    "A sustainable water bottle with built-in filter",
    "An ergonomic laptop stand that folds flat",
    "A minimalist phone mount for bikes"
  ];
  const [currentExample, setCurrentExample] = useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentExample((prev) => (prev + 1) % examplePrompts.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [examplePrompts.length]);

  // Load saved images from localStorage on mount
  React.useEffect(() => {
    const savedImages = localStorage.getItem('generatedImages');
    if (savedImages) {
      setGeneratedImages(JSON.parse(savedImages));
    }
  }, []);

  // Save images to localStorage whenever they change
  React.useEffect(() => {
    if (generatedImages.length > 0) {
      localStorage.setItem('generatedImages', JSON.stringify(generatedImages));
    }
  }, [generatedImages]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        setUploadedImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxFiles: 1
  });

  const generateImages = async () => {
    if (!prompt.trim() && !uploadedImage) return;

    setLoading(true);
    setError(null);
    setCurrentStep(1);

    try {
      const response = await fetch('/api/generateImage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          image: uploadedImage,
          type: activeTab === 'sketch' ? 'sketch' : activeTab === 'photo' ? 'inspiration' : undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate images');
      }

      if (data.success && data.images) {
        setCurrentStep(4);
        // Append new images to existing ones
        setGeneratedImages(prevImages => [...prevImages, ...data.images]);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
      setCurrentStep(0);
    }
  };

  // Add a function to clear saved images
  const clearSavedImages = () => {
    localStorage.removeItem('generatedImages');
    setGeneratedImages([]);
  };

  const handleEdit = async (image: GeneratedImage) => {
    try {
      const response = await fetch('/api/editImage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId: image.id,
          imageUrl: image.url,
          originalPrompt: image.prompt,
          viewType: image.viewType
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to set up image editing');
      }

      const data = await response.json();
      if (data.editSessionId) {
        // Navigate to the editor with the image URL as a query parameter
        const editorUrl = `/design/edit/${data.editSessionId}?image=${encodeURIComponent(image.url)}`;
        window.location.href = editorUrl;
      }
    } catch (error) {
      console.error('Error setting up image edit:', error);
      setError(error instanceof Error ? error.message : 'Failed to setup image editing');
    }
  };

  const handleConfirmDesign = async (imageUrl: string, index: number) => {
    setConfirming(index);
    try {
      // Save the design to the marketplace
      const response = await fetch('/api/marketplace/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          productType: 'product', // This will be refined by GPT-4 Vision analysis
          originalPrompt: prompt,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save design');
      }

      const { productId } = await response.json();
      
      // Redirect to the confirmation page
      window.location.href = `/design/confirm/${productId}`;
    } catch (error) {
      console.error('Error confirming design:', error);
      setError(error instanceof Error ? error.message : 'Failed to confirm design');
    } finally {
      setConfirming(null);
    }
  };

  const renderUploadArea = () => (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed border-blue-200 rounded-lg p-8 text-center space-y-4 bg-white/50 cursor-pointer transition-colors ${
        isDragActive ? 'border-blue-400 bg-blue-50' : ''
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
          {activeTab === 'sketch' ? <PenTool className="w-8 h-8" /> : <Camera className="w-8 h-8" />}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-blue-900">
            {isDragActive
              ? 'Drop the image here'
              : `Upload ${activeTab === 'sketch' ? 'a Sketch' : 'a Photo'}`}
          </h3>
          <p className="text-sm text-blue-800/70">
            {activeTab === 'sketch'
              ? 'Upload your hand-drawn sketch or digital drawing'
              : 'Upload an inspiration photo or similar product'}
          </p>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'describe':
        return (
          <div className="space-y-4">
            <textarea
              className="w-full p-4 border rounded-lg h-32 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-gray-900 placeholder-gray-600"
              placeholder="Describe your product idea in detail... We'll handle the technical stuff!"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading}
            />
            <div className="flex justify-center">
              <button
                onClick={generateImages}
                className={`px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity ${
                  loading || !prompt.trim() ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={loading || !prompt.trim()}
              >
                {loading ? 'Generating...' : 'Make it Real'}
              </button>
            </div>
          </div>
        );

      case 'sketch':
      case 'photo':
        return (
          <div className="space-y-4">
            {uploadedImage ? (
              <div className="relative">
                <img
                  src={`data:image/jpeg;base64,${uploadedImage}`}
                  alt="Uploaded image"
                  className="w-full max-h-64 object-contain rounded-lg"
                />
                <button
                  onClick={() => setUploadedImage(null)}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                >
                  <X className="w-4 h-4" />
                </button>
                <textarea
                  className="w-full mt-4 p-4 border rounded-lg h-32 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white/80"
                  placeholder={
                    activeTab === 'sketch'
                      ? 'Add any additional details about your sketch...'
                      : 'What aspects of this inspiration image would you like to incorporate?'
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading}
                />
                <div className="flex justify-center mt-4">
                  <button
                    onClick={generateImages}
                    className={`px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity ${
                      loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={loading}
                  >
                    {loading ? 'Generating...' : 'Generate from Image'}
                  </button>
                </div>
              </div>
            ) : (
              renderUploadArea()
            )}
          </div>
        );
    }
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all saved designs? This cannot be undone.')) {
      setGeneratedImages([]);
      localStorage.removeItem('generatedImages');
      
      // Also clear products from the store
      const products = productStore.getAllProducts();
      products.forEach(product => {
        productStore.deleteProduct(product.id);
      });
    }
  };

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={() => setActiveTab('describe')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === 'describe'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-white/50 text-blue-700 hover:bg-blue-50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Describe
        </button>
        <button
          onClick={() => setActiveTab('sketch')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === 'sketch'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-white/50 text-blue-700 hover:bg-blue-50'
          }`}
        >
          <PenTool className="w-4 h-4" />
          Sketch
        </button>
        <button
          onClick={() => setActiveTab('photo')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            activeTab === 'photo'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-white/50 text-blue-700 hover:bg-blue-50'
          }`}
        >
          <Camera className="w-4 h-4" />
          Photo
        </button>
      </div>

      {/* Example Prompt - only show for describe tab */}
      {activeTab === 'describe' && (
        <div className="text-center text-blue-800/70 italic mb-4">
          Try: "{examplePrompts[currentExample]}"
        </div>
      )}

      {/* Tab Content */}
      {renderTabContent()}

      {loading && (
        <div className="mt-8">
          <LoadingAnimation
            currentStep={currentStep}
            totalSteps={4}
            viewType="product"
          />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 mt-4">
          {error}
        </div>
      )}

      {/* Generated Images Display */}
      {generatedImages.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-blue-900">Generated Designs</h3>
            <button
              onClick={clearHistory}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Clear History
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {generatedImages.map((image, index) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.url}
                  alt={`Generated ${image.viewType} view`}
                  className="w-full aspect-square object-cover rounded-lg shadow-md"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center gap-2">
                    <button
                      onClick={() => handleEdit(image)}
                      className="px-4 py-2 bg-white/90 text-blue-900 rounded-full text-sm font-medium hover:bg-white transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleConfirmDesign(image.url, index)}
                      disabled={confirming !== null}
                      className="px-4 py-2 bg-green-500/90 text-white rounded-full text-sm font-medium hover:bg-green-500 transition-colors flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      {confirming === index ? 'Confirming...' : 'Confirm Design'}
                    </button>
                    <button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = image.url;
                        link.download = `createy-design-${image.viewType}.png`;
                        link.click();
                      }}
                      className="px-4 py-2 bg-purple-500/90 text-white rounded-full text-sm font-medium hover:bg-purple-500 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-1 bg-white/90 rounded-full text-sm font-medium text-blue-900">
                    {image.viewType} view
                  </span>
                </div>
                {/* Loading overlay when confirming */}
                {confirming === index && (
                  <div className="absolute inset-0 bg-black/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
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
                      <Sparkles className="w-8 h-8 text-white" />
                    </motion.div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGenerator; 