import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { HelpProvider } from '@/components/help';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MARS Executive Dashboards',
  description: 'Executive Dashboards for MARS Company',
  icons: {
    icon: [
      { url: '/drop-white.png', type: 'image/png' },
    ],
    apple: [
      { url: '/drop-white.png', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <HelpProvider />
      </body>
    </html>
  );
}
