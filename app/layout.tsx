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
  title: 'BWS Inc. | Sharing Tools, Skills & Legacy Together',
  description: 'A community platform inspired by the spirit of Black Wall Street, launching June 1st. Share tools, swap skills, and protect family wealth together.',
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
