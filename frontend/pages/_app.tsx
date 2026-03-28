import type { AppProps } from 'next/app';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { BackToTop } from '@/components/ui/BackToTop';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

import '@/styles/design-system.css';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter-native',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-native',
});

export default function MangroveShieldApp({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <LanguageProvider>
      <div className={`${inter.variable} ${jetBrainsMono.variable}`}>
        <Component {...pageProps} />
        <BackToTop />
      </div>
    </LanguageProvider>
  );
}
