'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Heart, Share2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  imageUrl: string;
  title: string;
  description: string;
  likes: number;
  productType: string;
  multiViewUrls: string[];
}

export default function ProductDetails() {
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/marketplace/products/${params.id}`);
        if (!response.ok) throw new Error('Failed to fetch product');
        const data = await response.json();
        setProduct(data);
      } catch (error) {
        console.error('Error fetching product:', error);
        setError(error instanceof Error ? error.message : 'Failed to load product');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [params.id]);

  const handleLike = async () => {
    if (!product) return;

    try {
      const response = await fetch(`/api/marketplace/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          likes: product.likes + (liked ? -1 : 1)
        }),
      });

      if (!response.ok) throw new Error('Failed to update likes');
      
      const updatedProduct = await response.json();
      setProduct(updatedProduct);
      setLiked(!liked);
    } catch (error) {
      console.error('Error updating likes:', error);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: product?.title,
        text: product?.description,
        url: window.location.href,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const nextImage = () => {
    if (!product?.multiViewUrls) return;
    setCurrentImageIndex((prev) => 
      prev === product.multiViewUrls.length - 1 ? 0 : prev + 1
    );
  };

  const previousImage = () => {
    if (!product?.multiViewUrls) return;
    setCurrentImageIndex((prev) => 
      prev === 0 ? product.multiViewUrls.length - 1 : prev - 1
    );
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

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg p-8">
          <p className="text-red-500">{error || 'Product not found'}</p>
          <Link href="/marketplace" className="mt-4 text-blue-500 hover:underline block">
            Return to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const allImages = [product.imageUrl, ...(product.multiViewUrls || [])];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/marketplace"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-8"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Marketplace
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div className="space-y-6">
            <div className="relative aspect-square bg-white rounded-xl shadow-sm overflow-hidden">
              <img
                src={allImages[currentImageIndex]}
                alt={product.title}
                className="w-full h-full object-contain"
              />
              
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={previousImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-sm hover:bg-white transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-700" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-sm hover:bg-white transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-700" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Navigation */}
            {allImages.length > 1 && (
              <div className="grid grid-cols-5 gap-4">
                {allImages.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                      currentImageIndex === index
                        ? 'border-blue-500'
                        : 'border-transparent hover:border-gray-200'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`View ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.title}</h1>
              <p className="text-lg text-gray-600 capitalize">{product.productType}</p>
            </div>

            <div className="prose prose-lg">
              <p className="whitespace-pre-wrap">{product.description}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleLike}
                className={`flex-1 px-6 py-3 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                  liked
                    ? 'bg-red-50 border-red-200 text-red-600'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                <span>{product.likes} likes</span>
              </button>
              <button
                onClick={handleShare}
                className="flex-1 px-6 py-3 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 