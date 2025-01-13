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
    console.log('Created image path:', imagePath);
    
    // 2. Save metadata to Firestore with only defined values
    console.log('Saving to Firestore...');
    const designsRef = collection(db, 'designs');
    const designData = {
      userId,
      imageUrl,
      mode,
      storagePath: imagePath,
      createdAt: serverTimestamp(),
      // Only include prompt if it exists
      ...(prompt && { prompt }),
    };

    console.log('Design data to save:', designData);
    const designDoc = await addDoc(designsRef, designData);

    console.log('Successfully saved to Firebase:', designDoc.id);
    return {
      id: designDoc.id,
      imageUrl,
      storagePath: imagePath
    };
  } catch (error) {
    console.error('Error saving design to Firebase:', error);
    throw error;
  }
} 