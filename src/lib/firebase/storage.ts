import { storage } from './config';
import { ref, uploadString, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';

interface UploadResult {
  url: string;
  path: string;
}

export async function uploadBase64Image(
  base64String: string,
  folder: 'designs' | 'references' = 'designs'
): Promise<UploadResult> {
  try {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${randomString}.png`;
    const path = `${folder}/${filename}`;
    
    const storageRef = ref(storage, path);
    const base64WithoutPrefix = base64String.replace(/^data:image\/\w+;base64,/, '');
    
    await uploadString(storageRef, base64WithoutPrefix, 'base64');
    const url = await getDownloadURL(storageRef);
    
    return { url, path };
  } catch (error) {
    console.error('Error uploading base64 image:', error);
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