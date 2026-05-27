import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'BWS Inc. | Premium Economic Ecosystem & Private Trust',
  description: 'An elite financial architecture and Private Trust landing platform launching June 1st.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[#09090b] text-[#e4e4e7] antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
