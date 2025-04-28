// pages/_app.js
import '../styles/globals.css'
import Link from 'next/link'

function MyApp({ Component, pageProps }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ← Navigation bar */}
      <header className="bg-blue-600 text-white p-4 flex space-x-6">
        <Link href="/">
          <a className="font-medium hover:underline">Dashboard</a>
        </Link>
        <Link href="/shipments/new">
          <a className="font-medium hover:underline">+ New Shipment</a>
        </Link>
      </header>

      {/* ← Page content */}
      <main className="flex-1 p-6 bg-gray-50">
        <Component {...pageProps} />
      </main>
    </div>
  )
}

export default MyApp
