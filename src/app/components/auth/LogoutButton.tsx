import { useDesignStore } from '@/lib/store/designs';
import { cleanupUserData } from '@/lib/firebase/utils';
import { useSession, signOut } from 'next-auth/react';

export function LogoutButton() {
  const { clearDesigns } = useDesignStore();
  const { data: session } = useSession();

  const handleLogout = async () => {
    try {
      if (session?.user?.id) {
        await cleanupUserData(session.user.id);
      }
      clearDesigns();
      await signOut();
    } catch (error) {
      console.error('Error during logout:', error);
      await signOut(); // Still sign out even if cleanup fails
    }
  };

  return (
    <button onClick={handleLogout}>
      Sign Out
    </button>
  );
} 