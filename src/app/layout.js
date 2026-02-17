import './globals.css';

export const metadata = {
  title: 'FinFlow — Gestão Financeira Pessoal',
  description: 'Gestão financeira pessoal com IA, scanner de recibos e forecast inteligente',
  manifest: '/manifest.json',
  themeColor: '#B24DFF',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FinFlow',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>{children}</body>
    </html>
  );
}
