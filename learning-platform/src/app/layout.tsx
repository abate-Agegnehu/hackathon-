import './globals.css'
import { Providers } from './providers';
import Navigation from '@/components/Navigation';

export const metadata = {
  title: 'Learning Platform',
  description: 'A modern platform for learning and skill development',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navigation>
            {children}
          </Navigation>
        </Providers>
      </body>
    </html>
  )
}
