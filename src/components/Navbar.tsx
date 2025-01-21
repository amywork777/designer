import { LogoutButton } from "./LogoutButton";
import { useSession } from "next-auth/react";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="flex items-center justify-between p-4 border-b">
      {/* ... other navbar items ... */}
      
      {session?.user && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {session.user.email}
          </span>
          <LogoutButton />
        </div>
      )}
    </nav>
  );
} 