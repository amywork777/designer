import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import imageCompression from 'browser-image-compression';
import { compressBase64Image } from '@/lib/utils';
import { saveDesignToFirebase, getUserDesigns } from '@/lib/firebase/utils';

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
  loadUserDesigns: (userId: string | null) => Promise<void>;
  addDesign: (design: Design, userId: string) => void;
  updateDesign: (id: string, updates: Partial<Design>) => void;
  clearDesigns: () => void;
}

export const useDesignStore = create<DesignStore>()(
  persist(
    (set, get) => ({
      designs: [],
      loadUserDesigns: async (userId: string | null) => {
        try {
          if (!userId) {
            set({ designs: [] }); // Clear designs if no user
            return;
          }
          const designs = await getUserDesigns(userId);
          set({ designs }); // Set designs when user is logged in
        } catch (error) {
          console.error('Error loading user designs:', error);
          // Don't clear designs on error, just log it
        }
      },
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
      clearDesigns: () => {
        set({ designs: [] });
      }
    }),
    {
      name: 'design-storage'
    }
  )
);