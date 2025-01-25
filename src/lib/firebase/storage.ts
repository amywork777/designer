import { storage } from './config';
import { ref, uploadString, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';

interface UploadResult {
  url: string;
  path: string;
}

// Define the exact file structure we want
const FILE_PATHS = {
  original: (userId: string, designId: string) => 
    `users/${userId}/designs/${designId}/original.png`,
  preview: (userId: string, designId: string) =>
    `users/${userId}/designs/${designId}/3d/preview.mp4`,
  model_0: (userId: string, designId: string) =>
    `users/${userId}/designs/${designId}/3d/model_0.glb`,
  model_1: (userId: string, designId: string) =>
    `users/${userId}/designs/${designId}/3d/model_1.glb`,
  preprocessed: (userId: string, designId: string) =>
    `users/${userId}/designs/${designId}/3d/preprocessed.png`,
  stl: (userId: string, designId: string) =>
    `users/${userId}/designs/${designId}/3d/model.stl`
} as const;

const CONTENT_TYPES = {
  original: 'image/png',
  preview: 'video/mp4',
  model_0: 'model/gltf-binary',
  model_1: 'model/gltf-binary',
  preprocessed: 'image/png',
  stl: 'application/octet-stream'
} as const;

type FileType = keyof typeof FILE_PATHS;

export async function uploadFile(
  data: string,
  userId: string,
  designId: string,
  fileType: FileType
): Promise<UploadResult> {
  try {
    console.log(`📤 Uploading ${fileType} for design ${designId}`);
    
    // Get the correct path and content type
    const path = FILE_PATHS[fileType](userId, designId);
    const contentType = CONTENT_TYPES[fileType];
    const storageRef = ref(storage, path);

    // Handle base64 data
    const base64Data = data.split(',')[1] || data;
    const cleanedBase64 = base64Data
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/\s/g, '');

    // Upload the file
    await uploadString(storageRef, cleanedBase64, 'base64', {
      contentType
    });

    // Get the download URL
    const url = await getDownloadURL(storageRef);

    return {
      url,
      path
    };
  } catch (error) {
    console.error(`❌ Error uploading ${fileType}:`, error);
    throw error;
  }
}

// Utility function to get the full storage path
export function getStoragePath(userId: string, designId: string, fileType: FileType): string {
  return FILE_PATHS[fileType](userId, designId);
}

// Utility function to get the base path for a design
export function getDesignBasePath(userId: string, designId: string): string {
  return `users/${userId}/designs/${designId}`;
}

// Function to delete all files for a design
export async function deleteDesignFiles(userId: string, designId: string): Promise<void> {
  const paths = Object.values(FILE_PATHS).map(pathFn => pathFn(userId, designId));
  
  console.log(`🗑️ Deleting files for design ${designId}`);
  
  const deletePromises = paths.map(async (path) => {
    try {
      const fileRef = ref(storage, path);
      await deleteObject(fileRef);
      console.log(`✅ Deleted file: ${path}`);
    } catch (error: any) {
      // Ignore if file doesn't exist
      if (error.code !== 'storage/object-not-found') {
        console.error(`❌ Error deleting file ${path}:`, error);
        throw error;
      }
    }
  });

  await Promise.all(deletePromises);
  console.log(`✅ Finished deleting files for design ${designId}`);
}