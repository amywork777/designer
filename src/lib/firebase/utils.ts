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

    // Handle different types of image URLs
    if (imageUrl.startsWith('data:image') || imageUrl.startsWith('blob:')) {
      // Convert blob URL to base64 if needed
      if (imageUrl.startsWith('blob:')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        downloadUrl = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } else {
        downloadUrl = imageUrl;
      }

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      imagePath = `designs/${userId}/${timestamp}-${randomId}.png`;
      const storageRef = ref(storage, imagePath);
      
      console.log('Uploading image to Storage...');
      const imageData = downloadUrl.split(',')[1];
      await uploadString(storageRef, imageData, 'base64', {
        contentType: 'image/png'
      });
      downloadUrl = await getDownloadURL(storageRef);
    }

    // Save metadata to Firestore
    console.log('Saving to Firestore with URL:', downloadUrl);
    const designData = {
      userId,
      imageUrl: downloadUrl,
      mode,
      ...(imagePath && { storagePath: imagePath }),
      createdAt: serverTimestamp(),
      ...(prompt && { prompt }),
      ...(originalDesignId && { originalDesignId })
    };

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