import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import imageCompression from 'browser-image-compression';
import { compressBase64Image } from '@/lib/utils';
import { saveDesignToFirebase } from '@/lib/firebase/utils';

const MAX_DESIGNS = 50;
const MAX_IMAGES_PER_DESIGN = 3;

interface Design {
  id: string;
  title: string;
  images: string[];
  createdAt: string;
  userId: string;
  prompt?: string;
  style?: string;
  referenceImages?: string[];
  threeDData?: {
    videoUrl: string;
    glbUrls: string[];
    preprocessedUrl: string;
    timestamp: number;
  };
}

interface DesignStore {
  designs: Design[];
  addDesign: (design: Omit<Design, 'id' | 'createdAt' | 'userId'>, userId: string) => Promise<Design>;
  updateDesign: (id: string, updates: Partial<Design>) => void;
  clearDesigns: () => void;
  getUserDesigns: (userId: string) => Design[];
}

export const useDesignStore = create<DesignStore>()(
  persist(
    (set, get) => ({
      designs: [],
      addDesign: async (design, userId) => {
        try {
          // Compress images
          const compressedImages = await Promise.all(
            design.images.map(async (img) => {
              try {
                return await compressBase64Image(img);
              } catch (error) {
                console.error('Error processing image:', error);
                return img; // Return original if compression fails
              }
            })
          );

          // Create the initial design object
          const initialDesign = {
            ...design,
            userId,
            createdAt: new Date().toISOString()
          };

          // Update the store immediately
          set((state) => ({
            designs: [initialDesign, ...state.designs]
          }));

          // Update the store with processed images
          set((state) => ({
            designs: state.designs.map(d => 
              d.id === initialDesign.id 
                ? { ...d, images: compressedImages }
                : d
            )
          }));

          return initialDesign;
        } catch (error) {
          console.error('Error adding design:', error);
          throw error;
        }
      },
      updateDesign: (id, updates) => {
        set((state) => ({
          designs: state.designs.map(design =>
            design.id === id ? { ...design, ...updates } : design
          )
        }));
      },
      clearDesigns: () => set({ designs: [] }),
      getUserDesigns: (userId) => {
        return get().designs
          .filter(design => design.userId === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    }),
    {
      name: 'design-storage',
      version: 1,
      getStorage: () => localStorage
    }
  )
);