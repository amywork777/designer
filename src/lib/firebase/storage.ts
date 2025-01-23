import { storage } from './config';
import { ref, uploadString, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';

interface UploadResult {
  url: string;
  path: string;
}

export async function uploadBase64Image(
  base64String: string,
  userId: string,
  designId: string,
  fileType: 'original' | '3d_preview' | '3d_model' | '3d_preprocessed' = 'original'
): Promise<UploadResult> {
  try {
    // Determine file extension based on type
    const extension = fileType === '3d_model' ? '.glb' : 
                     fileType === '3d_preview' ? '.mp4' : '.png';
    
    // Build the correct path based on file type
    const path = fileType.startsWith('3d_') 
      ? `users/${userId}/designs/${designId}/3d/${fileType.replace('3d_', '')}${extension}`
      : `users/${userId}/designs/${designId}/original${extension}`;
    
    const storageRef = ref(storage, path);
    const base64WithoutPrefix = base64String.replace(/^data:image\/\w+;base64,/, '');
    
    await uploadString(storageRef, base64WithoutPrefix, 'base64');
    const url = await getDownloadURL(storageRef);
    
    return { url, path };
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

export async function deleteFile(path: string): Promise<void> {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
} 