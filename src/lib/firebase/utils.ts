import { db } from './config';
import { storage } from './config';
import { collection, addDoc, serverTimestamp, getDoc, updateDoc, doc, query, where, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import { uploadFile, getDesignBasePath, deleteDesignFiles } from './storage';
import { ref, listAll, getDownloadURL } from 'firebase/storage';

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

    // Use the Firebase Auth UID instead of email
    console.log('Saving design with userId:', userId);

    const designData = {
      userId, // Use the raw UID
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
      const { url: finalUrl, path } = await uploadFile(
        imageUrl,
        userId,
        designId,
        'original'
      );

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
  newData: {
    videoUrl?: string;
    glbUrls?: string[];
    preprocessedUrl?: string;
    stlUrl?: string | null;
  }
) {
  try {
    // 1. Get existing data
    const docRef = doc(db, 'designs', designId);
    const docSnap = await getDoc(docRef);
    const existingData = docSnap.data();
    const existing3D = existingData?.threeDData || {};

    // 2. Create clean data object without undefined values
    const threeDData = {
      ...existing3D,
      timestamp: Date.now()
    };

    // Only add defined values
    if (newData.videoUrl) threeDData.videoUrl = newData.videoUrl;
    if (newData.glbUrls) threeDData.glbUrls = newData.glbUrls;
    if (newData.preprocessedUrl) threeDData.preprocessedUrl = newData.preprocessedUrl;
    if (newData.stlUrl !== undefined) threeDData.stlUrl = newData.stlUrl;

    // 3. Update Firestore
    await updateDoc(docRef, {
      threeDData,
      has3DPreview: true
    });

    return threeDData;
  } catch (error) {
    console.error('❌ Error updating 3D data:', error);
    throw error;
  }
}

export async function getUserDesigns(userId: string) {
  try {
    console.log('🔍 Getting designs for user:', userId);
    const designsRef = collection(db, 'designs');
    const q = query(
      designsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    console.log('📚 Raw Firestore response:', {
      userId,
      designCount: querySnapshot.size,
      empty: querySnapshot.empty
    });
    
    if (querySnapshot.empty) {
      console.log('❌ No designs found for user:', userId);
      return [];
    }

    const designs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      console.log('📄 Design data:', {
        id: doc.id,
        userId: data.userId,
        imageUrl: data.imageUrl,
        images: data.images,
        threeDData: data.threeDData
      });
      
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        images: data.images || (data.imageUrl ? [data.imageUrl] : []),
        title: data.title || data.prompt || 'Untitled Design',
        threeDData: data.threeDData || null
      };
    });

    console.log('✅ Processed designs:', {
      count: designs.length,
      designs: designs.map(d => ({
        id: d.id,
        userId: d.userId,
        hasImages: d.images?.length > 0,
        has3D: !!d.threeDData
      }))
    });

    return designs;
  } catch (error) {
    console.error('❌ Error getting user designs:', error);
    throw error;
  }
}

export async function get3DFilesForDesign(userId: string, designId: string) {
  try {
    // 1. First check Firestore
    const designRef = doc(db, 'designs', designId);
    const designDoc = await getDoc(designRef);
    const designData = designDoc.data();

    // If we have data in Firestore, verify it still exists in Storage
    if (designData?.threeDData?.videoUrl) {
      try {
        const videoRef = ref(storage, `processed/${userId}/${designId}/preview.mp4`);
        await getDownloadURL(videoRef);
        console.log('✅ Verified existing data is valid');
        return designData.threeDData;
      } catch {
        console.log('⚠️ Existing data invalid, clearing...');
        await updateDoc(designRef, {
          threeDData: null,
          has3DPreview: false
        });
      }
    }

    // 2. Check Storage for files
    const files = await listAll(ref(storage, `processed/${userId}/${designId}`));
    
    if (files.items.length > 0) {
      const threeDData = {
        videoUrl: '',
        glbUrls: [] as string[],
        preprocessedUrl: '',
        timestamp: Date.now()
      };

      // Get all URLs
      await Promise.all(files.items.map(async (file) => {
        const url = await getDownloadURL(file);
        const fileName = file.name.toLowerCase();
        
        switch (fileName) {
          case 'preview.mp4':
            threeDData.videoUrl = url;
            break;
          case 'model_0.glb':
            threeDData.glbUrls[0] = url;
            break;
          case 'model_1.glb':
            threeDData.glbUrls[1] = url;
            break;
          case 'preprocessed.png':
            threeDData.preprocessedUrl = url;
            break;
        }
      }));

      if (threeDData.videoUrl) {
        // Save to Firestore
        await updateDoc(designRef, {
          threeDData,
          has3DPreview: true,
          lastUpdated: serverTimestamp()
        });
        return threeDData;
      }
    }

    // 3. No valid data found, trigger processing
    return trigger3DProcessing(userId, designId);

  } catch (error) {
    console.error('Error in get3DFilesForDesign:', error);
    throw error;
  }
}

async function trigger3DProcessing(userId: string, designId: string, designData: any) {
  try {
    // Check if we already have 3D data
    const docRef = doc(db, 'designs', designId);
    const docSnap = await getDoc(docRef);
    const existing3D = docSnap.data()?.threeDData;

    if (existing3D?.videoUrl) {
      console.log('✅ Found existing 3D data:', existing3D);
      return existing3D;
    }

    const imageUrl = designData?.imageUrl || designData?.images?.[0];
    console.log('📸 Using image URL:', imageUrl);

    const response = await fetch('https://process-3d-mx7fddq5ia-uc.a.run.app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: imageUrl,
        userId,
        designId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawText = await response.text();
    console.log('📡 Raw response:', rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error('❌ Failed to parse response:', e);
      throw new Error('Invalid response from server');
    }

    if (!data.success) {
      throw new Error(data.error || 'Processing failed');
    }

    console.log('✅ Processing successful:', data);

    const threeDData = {
      videoUrl: data.video_url,
      glbUrls: data.glb_urls || [],
      preprocessedUrl: data.preprocessed_url,
      timestamp: Date.now(),
      stlUrl: data.stl_url
    };

    // Double verify the data was saved
    console.log('💾 Saving to Firestore:', threeDData);
    await updateDoc(docRef, {
      threeDData,
      has3DPreview: true
    });

    return threeDData;
  } catch (error) {
    console.error('❌ Error in trigger3DProcessing:', error);
    throw error;
  }
}

export function needs3DProcessing(design: any): boolean {
  if (!design) return false;
  
  // Check if 3D data exists and is complete
  const hasComplete3D = design.threeDData && 
    design.threeDData.videoUrl && 
    design.threeDData.glbUrls && 
    design.threeDData.glbUrls.length > 0;

  // Check if 3D processing was recently attempted
  const recentlyProcessed = design.threeDData?.timestamp && 
    (Date.now() - design.threeDData.timestamp) < 1000 * 60 * 5; // 5 minutes

  return !hasComplete3D && !recentlyProcessed;
}

export async function process3DPreview(design: any, userId: string, setProcessing3D?: (state: boolean) => void) {
  const logPrefix = '🔄 3D Preview:';
  console.log(`${logPrefix} Starting`, { 
    designId: design.id, 
    userId,
    imageCount: design.images?.length 
  });
  
  if (!design?.images?.[0]) {
    console.error(`${logPrefix} ❌ No image found in design`);
    return;
  }
  
  setProcessing3D?.(true);
  const startTime = Date.now();
  
  try {
    console.log(`${logPrefix} 📤 Sending request to processing endpoint`);
    const response = await fetch('https://process-3d-mx7fddq5ia-uc.a.run.app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: design.images[0],
        userId,
        designId: design.id,
        timestamp: startTime
      })
    });

    console.log(`${logPrefix} 📥 Response received`, {
      status: response.status,
      statusText: response.statusText,
      timeElapsed: `${(Date.now() - startTime)/1000}s`
    });

    const rawText = await response.text();
    console.log(`${logPrefix} 📡 Raw response:`, rawText.substring(0, 200) + '...');

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error(`${logPrefix} ❌ Failed to parse response:`, e);
      throw new Error('Invalid response from server');
    }
    
    if (data.success && data.video_url) {
      console.log(`${logPrefix} ✅ Processing successful`, {
        videoUrl: data.video_url.substring(0, 50) + '...',
        glbCount: data.glb_urls?.length || 0,
        processingTime: `${(Date.now() - startTime)/1000}s`
      });
      
      const merged3DData = await updateDesignWithThreeDData(design.id, userId, {
        videoUrl: data.video_url,
        glbUrls: data.glb_urls || [],
        preprocessedUrl: data.preprocessed_url,
        stlUrl: data.stl_url
      });

      console.log(`${logPrefix} 💾 Updated Firestore`, {
        designId: design.id,
        dataSize: JSON.stringify(merged3DData).length
      });
      
      return merged3DData;
    }
    
    console.error(`${logPrefix} ❌ Processing failed:`, data.error || 'No success response');
    throw new Error('Processing failed or no video URL returned');
  } catch (error) {
    console.error(`${logPrefix} ❌ Error:`, error);
    throw error;
  } finally {
    console.log(`${logPrefix} ⏱️ Total time: ${(Date.now() - startTime)/1000}s`);
    setProcessing3D?.(false);
  }
}

// Add this new function to verify 3D data
export async function verify3DData(userId: string, designId: string) {
  console.log('🔍 Verifying 3D data:', { userId, designId });
  
  try {
    const docRef = doc(db, 'designs', designId);
    const docSnap = await getDoc(docRef);
    const data = docSnap.data();
    
    if (!data?.threeDData?.videoUrl) {
      console.log('❌ No 3D data found in Firestore');
      return false;
    }

    console.log('🔎 Checking storage for video file...');
    const videoRef = ref(storage, `processed/${userId}/${designId}/preview.mp4`);
    try {
      await getDownloadURL(videoRef);
      console.log('✅ Video file verified successfully');
      return true;
    } catch {
      console.log('❌ Video file not found in storage');
      console.log('🧹 Cleaning up invalid data in Firestore...');
      await updateDoc(docRef, {
        threeDData: null,
        has3DPreview: false
      });
      return false;
    }
  } catch (error) {
    console.error('❌ Error verifying 3D data:', error);
    return false;
  }
}