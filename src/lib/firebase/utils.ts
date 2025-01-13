import { storage, db } from './config';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface SaveDesignProps {
  imageUrl: string;
  prompt?: string;
  userId: string;
  mode: 'generated' | 'uploaded';
}

export async function saveDesignToFirebase({
  imageUrl,
  prompt,
  userId,
  mode
}: SaveDesignProps) {
  try {
    console.log('Starting saveDesignToFirebase:', { userId, mode });
    
    if (!imageUrl || !userId) {
      throw new Error('imageUrl and userId are required');
    }

    // 1. Save image to Firebase Storage
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const imagePath = `designs/${userId}/${timestamp}-${randomId}.png`;
    const storageRef = ref(storage, imagePath);
    
    let downloadUrl = imageUrl;
    
    // Only upload to storage if it's a base64 image
    if (imageUrl.startsWith('data:image')) {
      console.log('Uploading base64 image to Storage...');
      const imageData = imageUrl.split(',')[1];
      await uploadString(storageRef, imageData, 'base64', {
        contentType: 'image/png'
      });
      downloadUrl = await getDownloadURL(storageRef);
    }

    // 2. Save metadata to Firestore
    console.log('Saving to Firestore...');
    const designsRef = collection(db, 'designs');
    const designData = {
      userId,
      imageUrl: downloadUrl,
      mode,
      storagePath: imagePath,
      createdAt: serverTimestamp(),
      ...(prompt && { prompt }),
    };

    console.log('Design data to save:', designData);
    const designDoc = await addDoc(designsRef, designData);

    console.log('Successfully saved to Firebase:', designDoc.id);
    return {
      id: designDoc.id,
      imageUrl: downloadUrl,
      storagePath: imagePath
    };
  } catch (error) {
    console.error('Error saving design to Firebase:', error);
    throw error;
  }
} 