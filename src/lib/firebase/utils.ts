import { storage, db } from './config';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, getDoc, updateDoc, doc } from 'firebase/firestore';

interface SaveDesignProps {
  imageUrl: string;
  prompt?: string;
  userId: string;
  mode: 'generated' | 'uploaded' | 'edited';
  originalDesignId?: string;
}

export async function saveDesignToFirebase({
  imageUrl,
  prompt,
  userId,
  mode,
  originalDesignId
}: SaveDesignProps) {
  try {
    console.log('Starting saveDesignToFirebase:', { userId, mode });
    
    if (!imageUrl || !userId) {
      throw new Error('imageUrl and userId are required');
    }

    let downloadUrl = imageUrl;
    let imagePath = '';

    // Only create storage entry for base64 images (uploads)
    if (imageUrl.startsWith('data:image')) {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      imagePath = `designs/${userId}/${timestamp}-${randomId}.png`;
      const storageRef = ref(storage, imagePath);
      
      console.log('Uploading base64 image to Storage...');
      const imageData = imageUrl.split(',')[1];
      await uploadString(storageRef, imageData, 'base64', {
        contentType: 'image/png'
      });
      downloadUrl = await getDownloadURL(storageRef);
    }

    // Save metadata to Firestore
    console.log('Saving to Firestore...');
    const designData = {
      userId,
      imageUrl: downloadUrl,
      mode,
      ...(imagePath && { storagePath: imagePath }), // Only add if we created a storage entry
      createdAt: serverTimestamp(),
      ...(prompt && { prompt }),
      ...(originalDesignId && { originalDesignId })
    };

    console.log('Design data to save:', designData);
    const designDoc = await addDoc(collection(db, 'designs'), designData);

    return {
      id: designDoc.id,
      imageUrl: downloadUrl,
      ...(imagePath && { storagePath: imagePath })
    };
  } catch (error) {
    console.error('Error saving design to Firebase:', error);
    throw error;
  }
} 