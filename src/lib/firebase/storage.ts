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
  model: (userId: string, designId: string) =>
    `users/${userId}/designs/${designId}/3d/model.glb`,
  model_1: (userId: string, designId: string) =>
    `users/${userId}/designs/${designId}/3d/model_1.glb`,
  preprocessed: (userId: string, designId: string) =>
    `users/${userId}/designs/${designId}/3d/preprocessed.png`
} as const;

const CONTENT_TYPES = {
  original: 'image/png',
  preview: 'video/mp4',
  model: 'model/gltf-binary',
  model_1: 'model/gltf-binary',
  preprocessed: 'image/png'
} as const;

type FileType = keyof typeof FILE_PATHS;

export async function uploadFile(
  data: Blob | string,
  userId: string,
  designId: string,
  fileType: FileType
): Promise<UploadResult> {
  try {
    const path = FILE_PATHS[fileType](userId, designId);
    const storageRef = ref(storage, path);
    const contentType = CONTENT_TYPES[fileType];

    if (data instanceof Blob) {
      await uploadBytes(storageRef, data, { contentType });
    } else if (data.startsWith('blob:')) {
      const response = await fetch(data);
      const blob = await response.blob();
      await uploadBytes(storageRef, blob, { contentType });
    } else {
      if (!data.startsWith('data:')) {
        data = `data:${contentType};base64,${data}`;
      }
      await uploadString(storageRef, data, 'data_url');
    }

    const url = await getDownloadURL(storageRef);
    return { url, path };
  } catch (error) {
    console.error(`Error uploading ${fileType}:`, error);
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

  const deletePromises = paths.map(async (path) => {
    try {
      const fileRef = ref(storage, path);
      await deleteObject(fileRef);
    } catch (error: any) {
      // Ignore if file doesn't exist
      if (error.code !== 'storage/object-not-found') {
        throw error;
      }
    }
  });

  await Promise.all(deletePromises);
}