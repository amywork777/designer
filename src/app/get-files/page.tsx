'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Package, Download } from 'lucide-react';
import { useDesignStore } from '@/lib/store/designs';
import { useToast } from "@/components/ui/use-toast";

export default function GetFiles() {
  const searchParams = useSearchParams();
  const designId = searchParams.get('designId');
  const { designs, loadDesign } = useDesignStore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [downloadCount, setDownloadCount] = useState(0);
  const design = designs.find(d => d.id === designId);

  useEffect(() => {
    async function loadDesignData() {
      if (!designId) {
        setIsLoading(false);
        return;
      }

      try {
        await loadDesign(designId);
      } catch (error) {
        console.error('Error loading design:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load design"
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadDesignData();
  }, [designId, loadDesign, toast]);

  const handleDownload = async (url: string, fileType: string) => {
    if (fileType === 'STL' && downloadCount >= 5) {
      toast({
        variant: "destructive",
        title: "Download Limit Reached",
        description: "You've used all your free STL downloads"
      });
      return;
    }

    let attempts = 0;
    const MAX_RETRIES = 3;

    while (attempts < MAX_RETRIES) {
      try {
        const proxyUrl = `/api/proxy-file?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });
        
        if (!response.ok) {
          throw new Error('Failed to download file');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `design.${fileType.toLowerCase()}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        if (fileType === 'STL') {
          setDownloadCount(prev => prev + 1);
          toast({
            title: "Success",
            description: `${5 - (downloadCount + 1)} STL downloads remaining`
          });
        }
        return; // Success - exit retry loop

      } catch (error) {
        console.error('Download attempt failed:', error);
        attempts++;
        
        if (attempts === MAX_RETRIES) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to download file after multiple attempts"
          });
        } else {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto text-gray-400 animate-pulse mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Loading Design...</h1>
        </div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Design Found</h1>
          <p className="text-gray-600">The design you're looking for could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Design Preview */}
      {design && (
        <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Design</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="aspect-square relative rounded-lg overflow-hidden">
              <img
                src={design.images[0]}
                alt="Design Preview"
                className="object-contain w-full h-full"
              />
            </div>
            {design?.threeDData?.videoUrl && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">3D Preview</h4>
                <video 
                  width="100%" 
                  height="auto" 
                  controls 
                  className="rounded-lg"
                  key={design.threeDData.videoUrl}
                >
                  <source 
                    src={design.threeDData.videoUrl} 
                    type="video/mp4" 
                  />
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Download Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* STL Files Section */}
        <div className="bg-indigo-600 rounded-xl p-8 text-white text-center">
          <Download className="w-8 h-8 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Get STL Files</h2>
          <p className="text-indigo-200 mb-4">Starting at 5 free/month</p>
          <div className="space-y-4">
            <button className="bg-white text-indigo-600 px-6 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors">
              View Plans
            </button>
            <button
              onClick={() => handleDownload(design?.threeDData?.glbUrls?.[0] || '', 'STL')}
              className="block w-full bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-400 transition-colors"
              disabled={downloadCount >= 5 || !design?.threeDData?.glbUrls?.[0]}
            >
              Download STL File
              <span className="text-sm block text-indigo-200">
                {5 - downloadCount} downloads remaining
              </span>
            </button>
          </div>
          <p className="text-sm text-indigo-200 mt-4">STL for 3D printing (instant)</p>
        </div>

        {/* STEP Files Section */}
        <div className="bg-indigo-500 rounded-xl p-8 text-white text-center">
          <Download className="w-8 h-8 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Get STEP Files</h2>
          <p className="text-indigo-200 mb-4">Available with Hobbyist plan</p>
          <button className="bg-white text-indigo-500 px-6 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors">
            View Plans
          </button>
          <p className="text-sm text-indigo-200 mt-4">STEP for CAD editing (24-48hr)</p>
        </div>
      </div>
    </div>
  );
} 