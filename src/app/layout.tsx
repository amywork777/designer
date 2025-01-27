import '@/styles/globals.css';
import { Providers } from '@/components/Providers';
import Header from '@/components/Header';
import { Viewport } from 'next';
import { PricingProvider } from '@/contexts/PricingContext';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { SubscriptionSuccessHandler } from '@/components/SubscriptionSuccessHandler';
import { SessionProvider } from "next-auth/react";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  title: 'Design Again',
  description: 'Turn your designs into reality',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <SubscriptionProvider>
            <SubscriptionSuccessHandler />
            <Providers>
              <PricingProvider>
                <Header />
                <main className="min-h-screen">
                  {children}
                </main>
              </PricingProvider>
            </Providers>
          </SubscriptionProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
