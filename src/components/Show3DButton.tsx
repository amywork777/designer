'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Design } from '@/lib/store/designs';

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
      const response = await fetch('https://process-3d-mx7fddq5ia-uc.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: design.images[0],
          userId: design.userId || 'default'
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
    <Button 
      onClick={process3DPreview}
      disabled={processing3D}
      className={className}
    >
      {processing3D ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : (
        'Generate 3D Preview'
      )}
    </Button>
  );
} 