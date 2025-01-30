import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { config } from './config';
import { storage } from './storage';

/**
 * Utility function to join CSS classes conditionally.
 * @param classes - Array of class names.
 * @returns Joined string of class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const compressBase64Image = async (base64: string): Promise<string> => {
  try {
    // If it's not a base64 string, return as is
    if (!base64.startsWith('data:image')) {
      return base64;
    }

    // Create an image element
    const img = document.createElement('img');
    img.crossOrigin = "anonymous";
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = base64;
    });

    // Create a canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('Could not get canvas context');
      return base64;
    }

    // Set dimensions
    const maxWidth = 800;
    const maxHeight = 800;
    let width = img.width;
    let height = img.height;

    // Calculate new dimensions
    if (width > height) {
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
      }
    }

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Fill with white background first
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    try {
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Error drawing image to canvas:', error);
      return base64; // Return original if drawing fails
    }
  } catch (error) {
    console.error('Error compressing image:', error);
    return base64; // Return original if compression fails
  }
};

// Make sure this is properly exported
export type { CompressImageFunction };
type CompressImageFunction = (base64: string) => Promise<string>;

// Storage utility functions
export const storage = {
  getFileSize: (file: File) => file.size,
  
  getFileType: (file: File) => file.type,
  
  isValidFileType: (file: File, allowedTypes: string[]) => 
    allowedTypes.includes(file.type),
    
  formatFileSize: (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

export default storage;

// Default configuration values
export const config = {
  storage: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  api: {
    timeout: 30000, // 30 seconds
    retries: 3,
  }
};

export default config;