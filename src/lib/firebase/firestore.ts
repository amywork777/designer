import { db } from './config';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';

export interface Design {
  id: string;
  title: string;
  images: string[];
  createdAt: string;
  userId: string;
  description?: string;
  manufacturingOption?: {
    name: string;
    description: string;
    setup: string;
    perUnit: string;
    leadTime: string;
  };
}

const designsCollection = collection(db, 'designs');

export async function createDesign(designData: Omit<Design, 'id'>): Promise<string> {
  const docRef = await addDoc(designsCollection, {
    ...designData,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function updateDesign(id: string, updates: Partial<Design>): Promise<void> {
  const designRef = doc(db, 'designs', id);
  await updateDoc(designRef, updates);
}

export async function getUserDesigns(userId: string): Promise<Design[]> {
  try {
    if (!userId || userId === 'anonymous') {
      return [];
    }

    const q = query(
      collection(db, 'designs'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const querySnapshot = await getDocs(q);
    const designs = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Log the design data in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Design data:', {
          id: doc.id,
          images: data.images,
          title: data.title,
          createdAt: data.createdAt
        });
      }
      return {
        id: doc.id,
        ...data
      };
    }) as Design[];

    if (process.env.NODE_ENV === 'development') {
      console.log(`Loaded ${designs.length} designs for user ${userId}`);
      console.log('Query path:', q._query.path);
      console.log('Query filters:', q._query.filters);
    }

    return designs;
  } catch (error) {
    console.error('Error fetching designs:', error);
    return [];
  }
} 