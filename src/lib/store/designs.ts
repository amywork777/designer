import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_DESIGNS = 10; // Maximum number of designs to store
const MAX_IMAGES_PER_DESIGN = 3; // Maximum number of images per design

interface Design {
  id: string;
  title: string;
  images: string[];
  createdAt: string;
  userId: string;
}

interface DesignStore {
  designs: Design[];
  addDesign: (design: Omit<Design, 'id' | 'createdAt' | 'userId'>, userId: string) => void;
  updateDesign: (id: string, updates: Partial<Design>) => void;
  clearDesigns: () => void;
  getUserDesigns: (userId: string) => Design[];
}

// Helper function to compress base64 image
const compressBase64Image = async (base64: string): Promise<string> => {
  try {
    // Convert base64 to blob
    const response = await fetch(base64);
    const blob = await response.blob();

    // Create canvas and context
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // Create a promise to handle image loading
    return new Promise((resolve) => {
      img.onload = () => {
        // Set canvas dimensions to 50% of original image
        canvas.width = img.width * 0.5;
        canvas.height = img.height * 0.5;

        // Draw and compress image
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress with 0.7 quality
      };
      img.src = base64;
    });
  } catch (error) {
    console.error('Image compression failed:', error);
    return base64; // Return original if compression fails
  }
};

export const useDesignStore = create<DesignStore>()(
  persist(
    (set, get) => ({
      designs: [],
      addDesign: async (design, userId) => {
        const designs = get().designs;
        
        // Compress images
        const compressedImages = await Promise.all(
          design.images.slice(0, MAX_IMAGES_PER_DESIGN).map(compressBase64Image)
        );

        // Create new design with compressed images
        const newDesign = {
          ...design,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          userId,
          images: compressedImages
        };

        // Get user's designs
        const userDesigns = designs.filter(d => d.userId === userId);

        // If user has max designs, remove oldest
        if (userDesigns.length >= MAX_DESIGNS) {
          const oldestDesign = userDesigns.reduce((oldest, current) => 
            new Date(current.createdAt) < new Date(oldest.createdAt) ? current : oldest
          );
          set({
            designs: [
              ...designs.filter(d => d.id !== oldestDesign.id),
              newDesign
            ]
          });
        } else {
          set({ designs: [...designs, newDesign] });
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
      }
    }),
    {
      name: 'design-storage',
      version: 1,
    }
  )
); 