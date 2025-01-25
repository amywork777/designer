import { db } from './config';
import { collection, addDoc, serverTimestamp, getDoc, updateDoc, doc, query, where, getDocs, orderBy, deleteDoc, setDoc } from 'firebase/firestore';
import { uploadFile, getDesignBasePath, deleteDesignFiles } from './storage';

interface SaveDesignProps {
  imageUrl: string;
  userId: string;
  mode: 'generated' | 'uploaded' | 'edited';
  prompt?: string;
  title?: string;
}

export async function saveDesignToFirebase(props: SaveDesignProps) {
  const { imageUrl, userId, mode, prompt, title = 'My Design' } = props;
  
  try {
    // Create an empty doc to get an auto ID
    const designRef = doc(collection(db, 'designs'));
    const designId = designRef.id;

    // Upload the image to v2 path
    const uploadedUrl = await uploadFile(imageUrl, userId, designId, 'original.png');

    // Create design document
    await setDoc(designRef, {
      id: designId,
      title,
      images: [uploadedUrl],
      userId,
      mode,
      prompt,
      createdAt: new Date().toISOString()
    });

    return {
      id: designId,
      imageUrl: uploadedUrl
    };
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

    // Use the new v2 paths
    if (threeDData.videoUrl) {
      uploadTasks.push(uploadFile(threeDData.videoUrl, userId, designId, 'preview'));
    }
    if (threeDData.glbUrls?.[0]) {
      uploadTasks.push(uploadFile(threeDData.glbUrls[0], userId, designId, 'model'));
    }
    if (threeDData.glbUrls?.[1]) {
      uploadTasks.push(uploadFile(threeDData.glbUrls[1], userId, designId, 'modelAlt'));
    }
    if (threeDData.preprocessedUrl) {
      uploadTasks.push(uploadFile(threeDData.preprocessedUrl, userId, designId, 'preprocessed'));
    }
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
