import './globals.css';
export const metadata = { title: 'Burger House Craft', description: 'Peça online e pague via PIX' };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function Root({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/logo.png" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
