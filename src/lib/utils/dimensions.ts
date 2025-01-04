export interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: 'mm' | 'cm' | 'inches';
}

export function parseDimensions(dimensionString: string): Dimensions {
  // Default values
  const defaultDimensions: Dimensions = {
    length: 0,
    width: 0,
    height: 0,
    unit: 'mm'
  };

  try {
    // Handle different formats like "100x50x25mm" or "10 x 5 x 2.5 inches"
    const cleanString = dimensionString.toLowerCase().replace(/\s+/g, '');
    
    // Extract unit
    let unit: 'mm' | 'cm' | 'inches' = 'mm';
    if (cleanString.includes('inch')) unit = 'inches';
    if (cleanString.includes('cm')) unit = 'cm';

    // Extract numbers
    const numbers = cleanString.match(/[\d.]+/g);
    if (numbers && numbers.length >= 3) {
      return {
        length: parseFloat(numbers[0]),
        width: parseFloat(numbers[1]),
        height: parseFloat(numbers[2]),
        unit
      };
    }
  } catch (error) {
    console.error('Error parsing dimensions:', error);
  }

  return defaultDimensions;
}

export function formatDimensions(dimensions: Dimensions): string {
  return `${dimensions.length} × ${dimensions.width} × ${dimensions.height} ${dimensions.unit}`;
} 