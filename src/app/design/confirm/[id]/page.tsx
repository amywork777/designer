'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sparkles, Check, Wand2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface ProductDetails {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  productType: string;
}

export default function ConfirmDesign() {
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/marketplace/products/${params.id}`);
        if (!response.ok) throw new Error('Failed to fetch product');
        
        const data = await response.json();
        setProduct(data.product);
        setTitle(data.product.title || '');
        setDescription(data.product.description || '');
      } catch (error) {
        console.error('Error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load product"
        });
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  const generateDetails = async () => {
    if (!product?.imageUrl) return;
    
    setGenerating(true);
    try {
      const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageUrl: product.imageUrl,
          productType: product.productType
        }),
      });

      if (!response.ok) throw new Error('Failed to generate details');
      
      const data = await response.json();
      setTitle(data.title);
      setDescription(data.description);

      toast({
        title: "Success",
        description: "Generated product details"
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate details"
      });
    } finally {
      setGenerating(false);
    }
  };

  const publishToMarketplace = async () => {
    if (!title || !description) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a title and description"
      });
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch(`/api/marketplace/products/${params.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });

      if (!response.ok) throw new Error('Failed to publish product');

      toast({
        title: "Success",
        description: "Product published to marketplace"
      });

      // Redirect to marketplace product page
      window.location.href = `/marketplace/products/${params.id}`;
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to publish product"
      });
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg p-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="w-12 h-12 text-blue-500" />
          </motion.div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Confirm Your Design</h1>
          <p className="text-gray-600">Add details about your product before publishing</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Product Image */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {product?.imageUrl && (
              <img
                src={product.imageUrl}
                alt="Product"
                className="w-full h-auto object-contain"
              />
            )}
          </div>

          {/* Product Details Form */}
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Product Details</h2>
                <button
                  onClick={generateDetails}
                  disabled={generating}
                  className="px-4 py-2 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  {generating ? 'Generating...' : 'Generate Details'}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-300 focus:outline-none"
                    placeholder="Enter product title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-300 focus:outline-none"
                    placeholder="Enter product description"
                  />
                </div>

                <button
                  onClick={publishToMarketplace}
                  disabled={publishing || !title || !description}
                  className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {publishing ? 'Publishing...' : 'Publish to Marketplace'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 