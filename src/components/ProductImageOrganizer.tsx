'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { useToast } from "@/components/ui/use-toast";

interface ProductImage {
  id: string;
  title: string;
  mainImage: string;
  thumbnails: string[];
}

export default function ProductImageOrganizer() {
  const { toast } = useToast();

  const [products, setProducts] = useState<ProductImage[]>([
    {
      id: 'water-bottle',
      title: 'Eco-Friendly Water Bottle',
      mainImage: '',
      thumbnails: ['', '', '', '']
    },
    {
      id: 'laptop-stand',
      title: 'Foldable Laptop Stand',
      mainImage: '',
      thumbnails: ['', '', '', '']
    },
    {
      id: 'plant-pot',
      title: 'Smart Plant Pot',
      mainImage: '',
      thumbnails: ['', '', '', '']
    },
    {
      id: 'backpack',
      title: 'Modular Backpack',
      mainImage: '',
      thumbnails: ['', '', '', '']
    }
  ]);

  const handleImageUpload = (productId: string, isMain: boolean, index: number = 0) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          setProducts(prevProducts => {
            return prevProducts.map(product => {
              if (product.id === productId) {
                if (isMain) {
                  return { ...product, mainImage: reader.result as string };
                } else {
                  const newThumbnails = [...product.thumbnails];
                  newThumbnails[index] = reader.result as string;
                  return { ...product, thumbnails: newThumbnails };
                }
              }
              return product;
            });
          });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const copyImagePaths = (product: ProductImage) => {
    const paths = {
      mainImage: `/images/community/${product.id}.png`,
      thumbnails: product.thumbnails.map((_, i) => `/images/community/${product.id}-${i + 2}.png`)
    };
    navigator.clipboard.writeText(JSON.stringify(paths, null, 2));
    alert('Image paths copied to clipboard!');
  };

  const handleInpaintingRequest = async (prompt: string, imageUrl: string) => {
    try {
      if (!prompt || !imageUrl) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Both prompt and image are required"
        });
        return;
      }

      if (prompt.length > 1000) {
        toast({
          variant: "warning",
          title: "Warning",
          description: "Prompt is too long and will be truncated. Please make it more concise."
        });
      }

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt,
          imageUrl 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process image');
      }

      if (!data.success) {
        throw new Error(data.error || 'Analysis failed');
      }

      toast({
        title: "Success",
        description: "Image analyzed successfully"
      });
      
      return data.analysis;

    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to process image'
      });
      throw error;
    }
  };

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-center">Product Image Organizer</h1>
      <div className="grid gap-6">
        {products.map((product) => (
          <Card key={product.id} className="p-4">
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">{product.title}</h2>
                <button
                  onClick={() => copyImagePaths(product)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Copy Paths
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="font-medium">Main Image:</p>
                  <div
                    onClick={() => handleImageUpload(product.id, true)}
                    className="relative h-64 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
                  >
                    {product.mainImage ? (
                      <Image
                        src={product.mainImage}
                        alt={product.title}
                        fill
                        className="object-contain rounded-lg"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        Click to upload main image
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Thumbnails:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {product.thumbnails.map((thumbnail, index) => (
                      <div
                        key={index}
                        onClick={() => handleImageUpload(product.id, false, index)}
                        className="relative h-28 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors"
                      >
                        {thumbnail ? (
                          <Image
                            src={thumbnail}
                            alt={`${product.title} thumbnail ${index + 1}`}
                            fill
                            className="object-contain rounded-lg"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm text-center">
                            Click to upload thumbnail {index + 1}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
} 