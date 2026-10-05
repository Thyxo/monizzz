import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'monizzz',
  description: 'Personlig budget- og opsparingstracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'monizzz',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased">
        {/* Paint the saved background before the app loads, so a light theme does not flash dark. */}
        <Script id="saved-theme" strategy="beforeInteractive">
          {"try{var u=JSON.parse(localStorage.getItem('monizzz_user'));if(u&&u.themeBgColor)document.documentElement.style.setProperty('--bg',u.themeBgColor)}catch(e){}"}
        </Script>
        {children}
      </body>
    </html>
  );
}
