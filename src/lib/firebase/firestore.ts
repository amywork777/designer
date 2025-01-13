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
  orderBy
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
  const q = query(
    designsCollection,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Design[];
} 