'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Download, Package, AlertTriangle, Loader2, Factory } from 'lucide-react';
import { useDesignStore } from '@/lib/store/designs';
import Link from 'next/link';
import { useToast } from "@/components/ui/use-toast";
import { useSession } from 'next-auth/react';
import { get3DFilesForDesign } from '@/lib/firebase/utils';
import { updateDesignWithThreeDData } from '@/lib/firebase/utils';
import { process3DPreview } from '@/lib/firebase/utils';
import { verify3DData } from '@/lib/firebase/utils';
import SignInPopup from '@/components/SignInPopup';

export default function GetFiles() {
  const searchParams = useSearchParams();
  const designId = searchParams.get('designId');
  const { designs, updateDesign } = useDesignStore();
  const design = designs.find(d => d.id === designId);
  const [processing3D, setProcessing3D] = useState(false);
  const { toast } = useToast();
  const { data: session } = useSession();
  const [showSignInPopup, setShowSignInPopup] = useState(false);
  const [filesUnlocked, setFilesUnlocked] = useState(false);
  const [isDownloadingSTL, setIsDownloadingSTL] = useState(false);

  // Trigger processing of 3D files on mount or when design/user changes
  useEffect(() => {
    if (design?.id && session?.user?.id) {
      process3DFiles();
    }
  }, [design?.id, session?.user?.id]);

  // Log current design data for debugging
  useEffect(() => {
    if (design && session?.user?.id) {
      console.log('Current design data:', {
        designId: design.id,
        userId: session.user.id,
        threeDData: design.threeDData,
      });
    }
  }, [design, session?.user?.id]);

  // Retrieve or show "Generating" for existing 3D files
  async function process3DFiles() {
    if (!design?.id || !session?.user?.id) return;
    try {
      const threeDData = await get3DFilesForDesign(session.user.id, design.id);
      if (threeDData?.videoUrl) {
        updateDesign(design.id, {
          threeDData,
          has3DPreview: true,
        });
        toast({
          title: 'Success',
          description: '3D preview loaded successfully',
        });
      } else {
        toast({
          title: 'Processing',
          description: 'Generating 3D preview...',
        });
      }
    } catch (error) {
      console.error('Error in process3DFiles:', error);
      toast({
        title: 'Error',
        description: 'Failed to load 3D preview',
        variant: 'destructive',
      });
    }
  }

  // Generate 3D preview (if user is signed in)
  async function handle3DProcessing() {
    if (!design || !session?.user?.id) {
      toast({
        title: 'Error',
        description: 'Please sign in to generate 3D preview',
        variant: 'destructive',
      });
      return;
    }
    try {
      const merged3DData = await process3DPreview(design, session.user.id, setProcessing3D);
      updateDesign(design.id, {
        threeDData: merged3DData,
        has3DPreview: true,
      });
      toast({
        title: 'Success',
        description: '3D preview generated successfully',
      });
    } catch (error) {
      console.error('Error getting 3D files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load 3D preview',
        variant: 'destructive',
      });
    }
  }

  // Unlock STL file (convert from GLB)
  async function handleUnlockFiles() {
    if (!session) {
      setShowSignInPopup(true);
      return;
    }
    try {
      if (!design?.threeDData?.glbUrls?.[0]) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No 3D model available for conversion',
        });
        return;
      }
      // Start conversion
      const response = await fetch('/api/convert-glb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          glbUrl: design.threeDData.glbUrls[0],
          designId: design.id,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Conversion failed');
      }
      // Get the STL data
      const stlBuffer = await response.arrayBuffer();
      const stlBlob = new Blob([stlBuffer], { type: 'application/octet-stream' });
      const userId = session.user.id;

      // Update design with STL data
      const updatedData = await updateDesignWithThreeDData(design.id, userId, {
        stlUrl: URL.createObjectURL(stlBlob),
      });

      updateDesign(design.id, {
        threeDData: {
          ...design.threeDData,
          stlUrl: updatedData.stlUrl,
        },
      });
      setFilesUnlocked(true);
      toast({
        title: 'Success',
        description: 'Files converted and unlocked successfully',
      });
    } catch (error: any) {
      console.error('Error unlocking files:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to unlock files',
      });
    }
  }

  // Handle STL or STEP download
  async function handleDownload(type: 'stl' | 'step') {
    if (!session?.user) {
      setShowSignInPopup(true);
      return;
    }
    if (!design?.threeDData?.glbUrls?.[0]) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No 3D model available for download',
      });
      return;
    }

    // STEP file: redirect to checkout
    if (type === 'step') {
      try {
        const response = await fetch('/api/step-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            designId: design?.id,
            designName: design?.name || 'Untitled',
          }),
        });
        const data = await response.json();
        if (data.error || !data.url) {
          throw new Error(data.error || 'No checkout URL received');
        }
        // Open checkout page
        window.open(data.url, '_blank');
      } catch (error: any) {
        console.error('Checkout error:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to initiate checkout',
        });
      }
      return;
    }

    // STL file: direct conversion + download
    if (type === 'stl') {
      try {
        setIsDownloadingSTL(true);
        const response = await fetch('/api/convert-glb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            glbUrl: design.threeDData.glbUrls[0],
            designId: design.id,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Conversion failed');
        }
        // Download file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${design.name || 'design'}.stl`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error: any) {
        console.error('Download error:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to download STL file',
        });
      } finally {
        setIsDownloadingSTL(false);
      }
      return;
    }
  }

  // Callback after sign-in
  const handleSignInSuccess = () => {
    setShowSignInPopup(false);
    toast({
      title: 'Success!',
      description: 'Successfully signed in',
    });
  };

  // If no design in store, show "not found"
  if (!design) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Design not found</h2>
          <p className="text-gray-600">Please select a valid design</p>
        </div>
      </div>
    );
  }

  // Main return
  return (
    <div className="min-h-screen bg-gray-50">
      {/* User Profile & Subscription Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              {session?.user ? (
                <>
                  {session.user.image && (
                    <img
                      src={session.user.image}
                      alt="Profile"
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {session.user.name || session.user.email}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-600">
                  Sign in to download files
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {design?.title || 'Design Preview'}
              </h1>
            </div>
          </div>

          {/* Original Design Preview */}
          <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100 mb-8">
            <img
              src={design?.images[0]}
              alt="Design Preview"
              className="object-contain w-full h-full"
            />
          </div>

          {/* 3D Preview Section */}
          {design?.threeDData?.videoUrl && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">3D Preview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Original Design */}
                <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={design.images[0]}
                    alt="Original Design"
                    className="object-contain w-full h-full"
                  />
                </div>

                {/* Video Preview */}
                <div className="aspect-square relative rounded-lg overflow-hidden bg-black">
                  <video
                    controls
                    className="w-full h-full object-contain"
                    poster={design.threeDData.preprocessedUrl}
                  >
                    <source src={design.threeDData.videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>

              {/* GLB Download Section */}
              {design.threeDData.glbUrls?.length > 0 && (
                <div className="mt-6">
                  <div className="flex gap-4">
                    {design.threeDData.glbUrls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        download={`model_${index + 1}.glb`}
                        className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg 
                          hover:bg-blue-600 transition-colors text-center"
                      >
                        Download Model {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generate 3D Button (if no 3D preview) */}
          {!design?.threeDData?.videoUrl && (
            <button
              onClick={handle3DProcessing}
              disabled={processing3D}
              className="mt-6 w-full px-4 py-2 bg-blue-500 text-white rounded-lg 
                hover:bg-blue-600 disabled:bg-gray-400 transition-colors"
            >
              {processing3D ? 'Processing...' : 'Generate 3D Preview'}
            </button>
          )}
        </div>

        {/* Creative Guidelines Section */}
        <div className="mt-8 bg-gray-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <InfoIcon className="w-5 h-5 text-blue-500" />
            Creative Guidelines
          </h3>
          <div className="space-y-4">
            <p className="text-gray-700">
              Our team will optimize your design for the best possible manufacturing outcome
              while maintaining its creative integrity.
            </p>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start gap-2">
                • We&apos;ll preserve all key design elements and artistic details
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
            </div>

            {!design?.threeDData?.videoUrl && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <p className="font-medium">3D Preview Required</p>
                </div>
                <p className="text-sm text-amber-600 mb-3">
                  Please generate a 3D preview before downloading the STL file. This helps ensure
                  your model is properly prepared for 3D printing.
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

            {/* Download STL Button */}
            <button
              onClick={() => handleDownload('stl')}
              disabled={!design?.threeDData?.videoUrl || isDownloadingSTL}
              className={`w-full py-4 rounded-lg transition-all transform hover:scale-[1.02] 
                shadow-lg hover:shadow-xl flex items-center justify-center gap-3 font-semibold text-lg
                ${
                  !design?.threeDData?.videoUrl || isDownloadingSTL
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
            >
              {isDownloadingSTL ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download STL
                </>
              )}
            </button>
          </div>

          {/* (Optional) Placeholder for STEP File or other second-column content */}
          {/* If you do NOT want a second column, you can remove this <div>. */}
          <div className="mt-8 md:mt-0 bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <InfoIcon className="w-5 h-5 text-blue-500" />
              Get It Made
            </h3>
            <div className="space-y-4">
              <p className="text-gray-700">
                If you&apos;re not ready to download the files, you can get your design made by our team.
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
      </div>

      {showSignInPopup && (
        <SignInPopup
          onClose={() => setShowSignInPopup(false)}
          onSuccess={handleSignInSuccess}
        />
      )}
    </div>
  );
}