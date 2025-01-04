import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

interface ManufacturingOption {
  name: string;
  description: string;
  bestFor: string;
  materials: string[];
  leadTime: string;
  costs: {
    setup: string;
    perUnit: string;
  };
}

interface AnalysisData {
  productDescription: string;
  dimensions: string;
  manufacturingOptions: ManufacturingOption[];
  selectedOption?: ManufacturingOption;
  status: 'pending' | 'analyzed' | 'checkout';
}

interface Design {
  id: string;
  userId: string | 'anonymous';
  images: string[];
  prompt: string;
  title: string;
  createdAt: string;
  analysis?: AnalysisData;
  imageVersions?: {
    [key: string]: {
      history: string[];
    };
  };
}

interface DesignStore {
  designs: Design[];
  addDesign: (design: Omit<Design, 'id' | 'createdAt' | 'userId'>, userId: string) => void;
  updateDesign: (id: string, updates: Partial<Design>) => void;
  clearDesigns: () => void;
  getUserDesigns: (userId: string) => Design[];
}

export const useDesignStore = create<DesignStore>()(
  persist(
    (set, get) => ({
      designs: [],
      addDesign: (design, userId = 'anonymous') => set((state) => ({
        designs: [
          {
            ...design,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            userId
          },
          ...state.designs,
        ],
      })),
      updateDesign: (id, updates) =>
        set((state) => ({
          designs: state.designs.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),
      clearDesigns: () => set({ designs: [] }),
      getUserDesigns: (userId: string) => {
        const allDesigns = get().designs;
        return allDesigns.filter(design => design.userId === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      },
    }),
    {
      name: 'design-storage',
    }
  )
); 