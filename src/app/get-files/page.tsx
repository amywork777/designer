'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Crown, Info as InfoIcon, Package, Loader2 } from 'lucide-react';
import { useDesignStore } from '@/lib/store/designs';
import Link from 'next/link';
import { toast } from '@/components/ui/use-toast';

export default function GetFiles() {
  const searchParams = useSearchParams();
  const designId = searchParams.get('designId');
  const { designs } = useDesignStore();
  const design = designs.find(d => d.id === designId);
  const [processing3D, setProcessing3D] = useState(false);

  if (!design) {
    return <div>Design not found</div>;
  }

  const handleSTLDownload = async () => {
    if (!design?.threeDData?.glbUrls?.[0]) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No 3D model available for conversion"
      });
      return;
    }

    try {
      const response = await fetch('/api/convert-glb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          glbUrl: design.threeDData.glbUrls[0],
          designId: design.id
        })
      });

      if (!response.ok) {
        throw new Error('Conversion failed');
      }

      // Create blob from response and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${design.id}.stl`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "STL file downloaded successfully"
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download STL file"
      });
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Design Preview Section */}
      <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Design</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Design Preview */}
          <div className="aspect-square relative rounded-lg overflow-hidden">
            <img
              src={design.images[0]}
              alt="Design Preview"
              className="object-contain w-full h-full"
            />
          </div>

          {/* 3D Preview if available */}
          {design?.threeDData?.videoUrl && design?.threeDData?.timestamp && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">3D Preview</h4>
              <div className="aspect-video">
                <video 
                  src={design.threeDData.videoUrl}
                  controls
                  className="w-full h-full rounded-lg"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <p className="text-sm text-gray-500 mt-2 italic">
                Note: This is an AI-generated preview. The actual 3D model will be professionally optimized for manufacturing.
              </p>
            </div>
          )}

          {/* Show 3D Generation Button if no video exists */}
          {(!design?.threeDData?.videoUrl || !design?.threeDData?.timestamp) && (
            <div>
              <button
                onClick={() => {
                  setProcessing3D(true);
                  // Add your 3D generation logic here
                  console.log('Generate 3D');
                }}
                disabled={processing3D}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 
                  disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {processing3D ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    Generate 3D Preview
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Creative Guidelines Section */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <InfoIcon className="w-5 h-5 text-blue-500" />
          Creative Guidelines
        </h3>
        
        <ul className="space-y-2 text-gray-600">
          <li className="flex items-start gap-2">
            • All key design elements and artistic details will be preserved
          </li>
          <li className="flex items-start gap-2">
            • Minor adjustments may be made to ensure structural stability
          </li>
          <li className="flex items-start gap-2">
            • Material-specific optimizations will be applied as needed
          </li>
        </ul>
      </div>

      {/* File Download Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* STL File Section */}
        <div className="bg-indigo-600 rounded-2xl p-6 text-white">
          <div className="flex flex-col items-center text-center mb-8">
            <Download className="w-8 h-8 mb-2" />
            <h2 className="text-2xl font-bold">Get STL Files</h2>
            <p className="text-indigo-200">Starting at 5 free/month</p>
          </div>

          <div className="bg-white rounded-xl p-6 text-gray-900">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">STL File</h3>
                <p className="text-gray-600">Optimized for 3D printing</p>
              </div>
              <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                Free Plan
              </span>
            </div>

            <p className="flex items-center text-gray-600 mb-4">
              <InfoIcon className="w-4 h-4 mr-2" />
              5 downloads remaining this month
            </p>

            <button
              onClick={handleSTLDownload}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg 
                transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-xl 
                flex items-center justify-center gap-3 font-semibold text-lg"
            >
              <Download className="w-5 h-5" />
              Download STL
            </button>

            <div className="mt-6 bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-purple-700 mb-2">
                <Crown className="w-5 h-5" />
                <p className="font-medium">Need more downloads?</p>
              </div>
              <p className="text-gray-600 text-sm">
                Get 50 downloads/month with Hobbyist ($12.99/mo) or unlimited with Pro ($39.99/mo)
              </p>
              <Link href="/plans" className="text-purple-600 hover:text-purple-700 font-medium mt-2 inline-block">
                View Plans →
              </Link>
            </div>
          </div>

          <p className="text-center text-indigo-200 mt-4">
            STL for 3D printing (instant)
          </p>
        </div>

        {/* STEP File Section */}
        <div className="bg-indigo-500 rounded-2xl p-6 text-white">
          <div className="flex flex-col items-center text-center mb-8">
            <Download className="w-8 h-8 mb-2" />
            <h2 className="text-2xl font-bold">Get STEP Files</h2>
            <p className="text-indigo-200">Available with Hobbyist plan</p>
          </div>

          <div className="bg-white rounded-xl p-6 text-gray-900">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">STEP File</h3>
                <p className="text-gray-600">For CAD editing</p>
              </div>
              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
                Paid Plans Only
              </span>
            </div>

            <div className="bg-yellow-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-yellow-700" />
                <p className="font-medium text-gray-800">Available with paid plans:</p>
              </div>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• Hobbyist: 5 STEP files/month</li>
                <li>• Pro: 20 STEP files/month</li>
              </ul>
            </div>

            <Link
              href="/plans"
              className="w-full py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 
                hover:to-yellow-700 text-white rounded-lg transition-all transform hover:scale-[1.02] 
                shadow-lg hover:shadow-xl flex items-center justify-center gap-3 font-semibold text-lg"
            >
              <Crown className="w-5 h-5" />
              Upgrade to Download
            </Link>
          </div>

          <p className="text-center text-indigo-200 mt-4">
            STEP for CAD editing (24-48hr)
          </p>
        </div>
      </div>
    </div>
  );
} 