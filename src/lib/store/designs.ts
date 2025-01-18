import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import imageCompression from 'browser-image-compression';

const MAX_DESIGNS = 10; // Maximum number of designs to store
const MAX_IMAGES_PER_DESIGN = 3; // Maximum number of images per design

interface Design {
  id: string;
  title: string;
  images: string[];
  createdAt: string;
  userId: string;
  threeDData?: {
    videoUrl: string;
    glbUrls: string[];
    preprocessedUrl: string;
    timestamp: number;
  };
}

interface DesignStore {
  designs: Design[];
  addDesign: (design: Omit<Design, 'id' | 'createdAt' | 'userId'>, userId: string) => void;
  updateDesign: (id: string, updates: Partial<Design>) => void;
  clearDesigns: () => void;
  getUserDesigns: (userId: string) => Design[];
  loadDesign: (designId: string) => Promise<void>;
}

// Helper function to compress base64 image
const compressBase64Image = async (base64: string): Promise<string> => {
  try {
    // If it's not a base64 string, return as is
    if (!base64.startsWith('data:image')) {
      return base64;
    }

    // Convert base64 to blob
    const response = await fetch(base64);
    const blob = await response.blob();

    // Compress using browser-image-compression
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1024,
      useWebWorker: true
    };

    const compressedBlob = await imageCompression(blob, options);

    // Convert back to base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(compressedBlob);
    });
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original image if compression fails
    return base64;
  }
};

export const useDesignStore = create<DesignStore>()(
  persist(
    (set, get) => ({
      designs: [],
      addDesign: async (design, userId) => {
        try {
          // Process images in parallel
          const processedImages = await Promise.all(
            design.images.map(async (img) => {
              try {
                return await compressBase64Image(img);
              } catch (error) {
                console.error('Error processing image:', error);
                return img; // Use original if compression fails
              }
            })
          );

          const processedReferenceImage = design.referenceImage 
            ? await compressBase64Image(design.referenceImage)
            : null;

          const newDesign = {
            ...design,
            images: processedImages,
            referenceImage: processedReferenceImage
          };

          set((state) => ({
            designs: [{
              ...newDesign,
              userId
            }, ...state.designs]
          }));
        } catch (error) {
          console.error('Error adding design:', error);
          throw error;
        }
      },
      updateDesign: (id, updates) => {
        set({
          designs: get().designs.map(design =>
            design.id === id ? { ...design, ...updates } : design
          )
        });
      },
      clearDesigns: () => set({ designs: [] }),
      getUserDesigns: (userId) => {
        return get().designs
          .filter(design => design.userId === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
      loadDesign: async (designId: string) => {
        try {
          // Check if design already exists in store
          const existingDesign = get().designs.find(d => d.id === designId);
          
          // Create threeDData object with the correct structure
          const threeDData = {
            videoUrl: `https://storage.googleapis.com/taiyaki-test1.firebasestorage.app/processed/anonymous/${designId}/preview.mp4`,
            glbUrls: [
              `https://storage.googleapis.com/taiyaki-test1.firebasestorage.app/processed/anonymous/${designId}/model_0.glb`,
              `https://storage.googleapis.com/taiyaki-test1.firebasestorage.app/processed/anonymous/${designId}/model_1.glb`
            ],
            preprocessedUrl: `https://storage.googleapis.com/taiyaki-test1.firebasestorage.app/processed/anonymous/${designId}/preprocessed.png`,
            timestamp: parseInt(designId.split('-')[0])
          };

          if (existingDesign) {
            // Update existing design with threeDData
            set({
              designs: get().designs.map(design =>
                design.id === designId 
                  ? { ...design, threeDData } 
                  : design
              )
            });
            return;
          }

          // If design doesn't exist, create new one with threeDData
          const designUrl = `https://firebasestorage.googleapis.com/v0/b/taiyaki-test1.firebasestorage.app/o/designs%2Fanonymous%2F${designId}.png?alt=media`;
          
          const newDesign = {
            id: designId,
            title: 'Loaded Design',
            images: [designUrl],
            createdAt: new Date().toISOString(),
            userId: 'anonymous',
            threeDData
          };

          set((state) => ({
            designs: [newDesign, ...state.designs]
          }));

        } catch (error) {
          console.error('Error loading design:', error);
          throw error;
        }
      }
    }),
    {
      name: 'design-storage',
      version: 1,
    }
  )
); 