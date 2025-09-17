import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Header Harbor',
  description: 'Reclaim your inbox, one header at a time.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
