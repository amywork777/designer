import '@/styles/globals.css';
import { Providers } from '@/components/Providers';
import Header from '@/components/Header';
import { Viewport } from 'next';
import { PricingProvider } from '@/contexts/PricingContext';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata = {
  title: 'taiyaki',
  description: 'imagine it. manufacture it.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' }
    ],
    apple: { url: '/apple-touch-icon.png' },
    other: [
      {
        rel: 'manifest',
        url: '/site.webmanifest'
      }
    ]
  },
  manifest: '/site.webmanifest'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <PricingProvider>
            <Header />
            <main className="min-h-screen">
              {children}
            </main>
          </PricingProvider>
        </Providers>
      </body>
    </html>
  );
}