'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Design } from '@/lib/store/designs';
import { useSession } from 'next-auth/react';
import { Cube } from 'lucide-react';

interface Show3DButtonProps {
  design: Design | undefined;
  processing3D: boolean;
  setProcessing3D: (value: boolean) => void;
  className?: string;
}

export default function Show3DButton({ 
  design, 
  processing3D, 
  setProcessing3D,
  className = ''
}: Show3DButtonProps) {
  const { toast } = useToast();
  const session = useSession();

  const process3DPreview = async () => {
    if (!design?.images[0]) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No design selected"
      });
      return;
    }
    
    setProcessing3D(true);
    try {
      // Use anonymous for userId if not signed in
      const userId = session?.user?.id || 'anonymous';
      
      const response = await fetch('https://us-central1-taiyaki-test1.cloudfunctions.net/process_3d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: design.images[0],
          userId: userId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process 3D model');
      }

      if (data.success) {
        toast({
          title: "Success",
          description: "3D preview generated successfully"
        });
      }
    } catch (error) {
      console.error('3D processing error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate 3D model"
      });
    } finally {
      setProcessing3D(false);
    }
  };

  return (
    <button
      onClick={process3DPreview}
      disabled={processing3D}
      className={`${className} w-full flex items-center justify-center gap-2 px-4 py-2 
        bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 
        disabled:cursor-not-allowed transition-colors`}
    >
      {processing3D ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating 3D...
        </>
      ) : (
        <>
          <Cube className="w-4 h-4" />
          Show 3D
        </>
      )}
    </button>
  );
} 