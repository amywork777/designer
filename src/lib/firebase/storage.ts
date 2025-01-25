import { storage } from './config';
import { ref, uploadString, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';

interface UploadResult {
  url: string;
  path: string;
}

// Define the exact file structure we want
const FILE_PATHS = {
  // For authenticated users
  userPath: (userId: string, designId: string, filename: string) => 
    `v2/users/${userId}/${designId}/${filename}`,
  
  // For anonymous users
  anonymousPath: (designId: string, filename: string) => 
    `v2/anonymous/${designId}/${filename}`,
};

const CONTENT_TYPES = {
  original: 'image/png',
  preview: 'video/mp4',
  model: 'model/gltf-binary',
  modelAlt: 'model/gltf-binary',
  preprocessed: 'image/png',
  stl: 'application/octet-stream'
} as const;

type FileType = keyof typeof FILE_PATHS;

export async function uploadFile(
  file: File | string,
  userId: string,
  designId: string,
  filename: string
) {
  try {
    const storagePath = getStoragePath(userId, designId, filename);
    const storageRef = ref(storage, storagePath);
    
    if (typeof file === 'string') {
      // Handle base64 or URL string
      if (file.startsWith('data:')) {
        // Base64 data URL
        const response = await fetch(file);
        const blob = await response.blob();
        await uploadBytes(storageRef, blob);
      } else {
        // Regular URL
        const response = await fetch(file);
        const blob = await response.blob();
        await uploadBytes(storageRef, blob);
      }
    } else {
      // Handle File object
      await uploadBytes(storageRef, file);
    }
    
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error(`Error uploading ${filename}:`, error);
    throw error;
  }
}

// Utility function to get the full storage path
export function getStoragePath(userId: string | null, designId: string, filename: string) {
  return !userId || userId === 'anonymous'
    ? FILE_PATHS.anonymousPath(designId, filename)
    : FILE_PATHS.userPath(userId, designId, filename);
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

export async function uploadDesignFile(
  userId: string,
  designId: string,
  file: File,
  fileType: keyof DesignFiles
): Promise<string> {
  // Match your current structure: v2/users/{userId}/{designId}/{fileType}
  const path = `v2/users/${userId}/${designId}/${fileType}${getFileExtension(file.name)}`;
  const storageRef = ref(storage, path);
  
  console.log(`Uploading to path: ${path}`); // Debug log
  
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  
  return url;
}

function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop();
  switch (ext?.toLowerCase()) {
    case 'png':
    case 'jpg':
    case 'jpeg':
      return '.png';
    case 'mp4':
      return '.mp4';
    case 'glb':
      return '.glb';
    case 'stl':
      return '.stl';
    default:
      return '.png';
  }
}

// Helper function to get the storage path for a design file
export function getDesignFilePath(
  userId: string,
  designId: string,
  fileType: keyof DesignFiles
): string {
  return `v2/users/${userId}/${designId}/${fileType}`;
}