import { db } from './config';
import { collection, addDoc, serverTimestamp, getDoc, updateDoc, doc, query, where, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import { uploadFile, getDesignBasePath, deleteDesignFiles } from './storage';

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
    if (!imageUrl || !userId) {
      throw new Error('imageUrl and userId are required');
    }

    // Create design document first to get an ID
    const designData = {
      userId,
      mode,
      createdAt: serverTimestamp(),
      ...(prompt && { prompt }),
      ...(originalDesignId && { originalDesignId }),
      ...(threeDData && { threeDData }),
      title: prompt || 'Untitled Design',
      status: 'active',
      storagePath: ''
    };

    const designDoc = await addDoc(collection(db, 'designs'), designData);
    const designId = designDoc.id;

    try {
      // Upload the image to the correct path
      const { url: finalUrl, path } = await uploadFile(
        imageUrl,
        userId,
        designId,
        'original'
      );

      // Update the document with the storage path and URL
      const updatedData = {
        imageUrl: finalUrl,
        storagePath: getDesignBasePath(userId, designId),
        images: [finalUrl]
      };

      await updateDoc(doc(db, 'designs', designId), updatedData);

      return {
        id: designId,
        ...designData,
        ...updatedData,
        createdAt: new Date().toISOString()
      };
    } catch (uploadError) {
      // If upload fails, delete the design document
      await deleteDoc(doc(db, 'designs', designId));
      throw uploadError;
    }
  } catch (error) {
    console.error('Error saving design to Firebase:', error);
    throw error;
  }
}

export async function updateDesignWithThreeDData(
  designId: string, 
  userId: string,
  threeDData: {
    videoUrl?: string;
    glbUrls?: string[];
    preprocessedUrl?: string;
    stlUrl?: string;
  }
) {
  try {
    const uploadTasks = [];

    // Add existing upload tasks
    if (threeDData.videoUrl) {
      uploadTasks.push(uploadFile(threeDData.videoUrl, userId, designId, 'preview'));
    }
    if (threeDData.glbUrls?.[0]) {
      uploadTasks.push(uploadFile(threeDData.glbUrls[0], userId, designId, 'model'));
    }
    if (threeDData.glbUrls?.[1]) {
      uploadTasks.push(uploadFile(threeDData.glbUrls[1], userId, designId, 'model_1'));
    }
    if (threeDData.preprocessedUrl) {
      uploadTasks.push(uploadFile(threeDData.preprocessedUrl, userId, designId, 'preprocessed'));
    }
    // Add STL upload task
    if (threeDData.stlUrl) {
      uploadTasks.push(uploadFile(threeDData.stlUrl, userId, designId, 'stl'));
    }

    const results = await Promise.all(uploadTasks);
    
    const updatedData: any = {};
    results.forEach(({ url }, index) => {
      if (index === 0 && threeDData.videoUrl) updatedData.videoUrl = url;
      if (index === 1 && threeDData.glbUrls?.[0]) updatedData.glbUrls = [url];
      if (index === 2 && threeDData.glbUrls?.[1]) updatedData.glbUrls = [...(updatedData.glbUrls || []), url];
      if (index === 3 && threeDData.preprocessedUrl) updatedData.preprocessedUrl = url;
      if (index === 4 && threeDData.stlUrl) updatedData.stlUrl = url;
    });

    await updateDoc(doc(db, 'designs', designId), {
      threeDData: updatedData
    });

    return updatedData;
  } catch (error) {
    console.error('Error updating design with 3D data:', error);
    throw error;
  }
}

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