import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import Link from 'next/link'
import { Package } from 'lucide-react'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Allo Inventory',
  description: 'Warehouse inventory management system — track stock, manage reservations, fulfil orders.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">

        {/* ── Top navigation ─────────────────────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <nav
            className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6"
            aria-label="Main navigation"
          >
            {/* Brand */}
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold text-slate-900 hover:text-blue-600 transition-colors"
              aria-label="Allo Inventory home"
            >
              <Package className="h-5 w-5 text-blue-600" aria-hidden="true" />
              <span>Allo Inventory</span>
            </Link>

            {/* Nav links */}
            <div className="flex items-center gap-1 text-sm font-medium">
              <Link
                href="/products"
                className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Products
              </Link>
              <Link
                href="/warehouses"
                className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Warehouses
              </Link>
            </div>
          </nav>
        </header>

        {/* ── Page content ───────────────────────────────────────── */}
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6" id="main-content">
          {children}
        </main>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          Allo Inventory © {new Date().getFullYear()}
        </footer>

        {/* ── Toast notifications (Sonner) ──────────────────────── */}
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            classNames: {
              toast: 'font-sans text-sm',
            },
          }}
        />
      </body>
    </html>
  )
}
