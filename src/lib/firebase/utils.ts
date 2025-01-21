import { storage, db } from './config';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, getDoc, updateDoc, doc, query, where, getDocs, orderBy } from 'firebase/firestore';

interface SaveDesignProps {
  imageUrl: string;
  prompt?: string;
  userId: string;
  mode: 'generated' | 'uploaded' | 'edited';
  originalDesignId?: string;
  threeDData?: string;
}

export async function saveDesignToFirebase({
  imageUrl,
  prompt,
  userId,
  mode,
  originalDesignId,
  threeDData
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

    // Enhanced design data structure
    const designData = {
      userId,
      imageUrl: downloadUrl,
      mode,
      ...(imagePath && { storagePath: imagePath }),
      createdAt: serverTimestamp(),
      ...(prompt && { prompt }),
      ...(originalDesignId && { originalDesignId }),
      ...(threeDData && { threeDData }),
      title: prompt || 'Untitled Design',
      images: [downloadUrl],
      status: 'active'
    };

    const designDoc = await addDoc(collection(db, 'designs'), designData);
    
    return {
      id: designDoc.id,
      ...designData,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error saving design to Firebase:', error);
    throw error;
  }
}

// Add this new function to fetch user's designs
export async function getUserDesigns(userId: string) {
  try {
    if (!userId) throw new Error('userId is required');

    const designsRef = collection(db, 'designs');
    const q = query(
      designsRef,
      where('userId', '==', userId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error fetching user designs:', error);
    throw error;
  }
} 