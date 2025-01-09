export type SizeType = 'Mini' | 'Small' | 'Medium' | 'Large';

export interface Size {
  name: SizeType;
  dimensions: string;
  maxDimensions: [number, number, number];
  description: string;
}

export const SIZES: Size[] = [
  {
    name: 'Mini',
    dimensions: '2x2x2in',
    maxDimensions: [2, 2, 2],
    description: 'Perfect for small decorative items and miniatures'
  },
  {
    name: 'Small',
    dimensions: '3.5x3.5x3.5in',
    maxDimensions: [3.5, 3.5, 3.5],
    description: 'Ideal for desktop accessories and small functional parts'
  },
  {
    name: 'Medium',
    dimensions: '5x5x5in',
    maxDimensions: [5, 5, 5],
    description: 'Great for most household items and medium-sized models'
  },
  {
    name: 'Large',
    dimensions: '10x10x10in',
    maxDimensions: [10, 10, 10],
    description: 'Suitable for large display pieces and substantial items'
  }
]; 