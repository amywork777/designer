'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Crown, Info as InfoIcon, Package, AlertTriangle, Loader2, Factory } from 'lucide-react';
import { useDesignStore } from '@/lib/store/designs';
import Link from 'next/link';
import { useToast } from "@/components/ui/use-toast";

export default function GetFiles() {
  const searchParams = useSearchParams();
  const designId = searchParams.get('designId');
  const { designs, updateDesign } = useDesignStore();
  const design = designs.find(d => d.id === designId);
  const [processing3D, setProcessing3D] = useState(false);
  const { toast } = useToast();

  const MAX_RETRIES = 3;

  const handle3DProcessing = async () => {
    if (!design?.images[0]) return;
    
    setProcessing3D(true);
    let attempts = 0;
    
    while (attempts < MAX_RETRIES) {
      try {
        const response = await fetch('https://us-central1-taiyaki-test1.cloudfunctions.net/process_3d', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image_url: design.images[0],
            userId: 'default'  // Replace with actual user ID when auth is implemented
          })
        });

        const rawText = await response.text();
        console.log('Raw response:', rawText);

        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          console.error('Failed to parse response:', e);
          throw new Error('Invalid response from server');
        }

        if (!response.ok) {
          throw new Error(data.error || 'Server error');
        }

        if (data.success && data.video_url) {
          // Update the design with 3D data
          updateDesign(design.id, {
            threeDData: {
              videoUrl: data.video_url,
              glbUrls: data.glb_urls || [],
              preprocessedUrl: data.preprocessed_url,
              timestamp: data.timestamp
            }
          });

          toast({
            title: "Success",
            description: "3D preview generated successfully"
          });
          return; // Success - exit the retry loop
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retrying
        
      } catch (error) {
        console.error('Error generating 3D:', error);
        attempts++;
        
        if (attempts >= MAX_RETRIES) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to generate 3D preview after multiple attempts"
          });
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retrying
      }
    }
    
    setProcessing3D(false);
  };

  const handleDownload = async (type: 'stl' | 'step') => {
    if (!design?.threeDData?.glbUrls?.[0]) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No 3D model available for download"
      });
      return;
    }

    try {
      console.log('Starting conversion for GLB:', design.threeDData.glbUrls[0]);
      
      const response = await fetch('/api/convert-glb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          glbUrl: design.threeDData.glbUrls[0],
          designId: design.id
        })
      });

      // Log the raw response for debugging
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.details || errorData.error || 'Failed to convert file';
        } catch {
          errorMessage = 'Failed to convert file';
        }
        throw new Error(errorMessage);
      }

      // Convert the text back to blob for download
      const blob = new Blob([responseText], { type: 'application/octet-stream' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${design.id}.stl`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "STL file downloaded successfully"
      });

    } catch (error) {
      console.error('Error downloading STL:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to download STL file"
      });
    }
  };

  if (!design) {
    return <div>Design not found</div>;
  }

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
                onClick={handle3DProcessing}
                disabled={processing3D}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 
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
        
        <div className="space-y-4">
          <p className="text-gray-700">
            Our team will optimize your design for the best possible manufacturing outcome while maintaining its creative integrity.
          </p>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              • We'll preserve all key design elements and artistic details
            </li>
            <li className="flex items-start gap-2">
              • Minor adjustments may be made to ensure structural stability
            </li>
            <li className="flex items-start gap-2">
              • Material-specific optimizations will be applied as needed
            </li>
          </ul>
        </div>
      </div>

      {/* File Download Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* STL File Section */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold">STL File</h3>
              <p className="text-gray-600">STL for 3D printing (instant)</p>
            </div>
            <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
              Free Plan
            </span>
          </div>

          {!design?.threeDData?.videoUrl && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <p className="font-medium">3D Preview Required</p>
              </div>
              <p className="text-sm text-amber-600 mb-3">
                Please generate a 3D preview before downloading the STL file. This helps ensure your model is properly prepared for 3D printing.
              </p>
              <button
                onClick={handle3DProcessing}
                disabled={processing3D}
                className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 
                  rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                {processing3D ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Preview...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    Generate 3D Preview First
                  </>
                )}
              </button>
            </div>
          )}

          <Link 
            href={`/get-files?designId=${design.id}`}
            className={`w-full py-4 rounded-lg transition-all transform hover:scale-[1.02] 
              shadow-lg hover:shadow-xl flex items-center justify-center gap-3 font-semibold text-lg
              ${!design?.threeDData?.videoUrl 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
          >
            <Download className="w-5 h-5" />
            Get Files
          </Link>

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

        {/* STEP File Section */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold">STEP File</h3>
              <p className="text-gray-600">for CAD editing (24-48 hr)</p>
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
      </div>

      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <InfoIcon className="w-5 h-5 text-blue-500" />
          Get It Made
        </h3>
        
        <div className="space-y-4">
          <p className="text-gray-700">
            If you're not ready to download the files, you can get your design made by our team.
          </p>
          <Link 
            href={`/get-it-made?designId=${design.id}`}
            className="w-full py-4 rounded-lg transition-all transform hover:scale-[1.02] 
              shadow-lg hover:shadow-xl flex items-center justify-center gap-3 font-semibold text-lg
              bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Factory className="w-5 h-5" />
            Get It Made
          </Link>
        </div>
      </div>
    </div>
  );
} 