import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function AdminPage() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-white">
      <header className="border-b border-white/10 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-light">
            <ArrowLeft className="h-4 w-4" />
            Back to Portfolio
          </Link>
          <div className="text-xl font-light tracking-wider">
            <span className="font-bold">ADMIN</span> DASHBOARD
          </div>
          <div className="w-24"></div> {/* Spacer for balance */}
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur-sm">
          <h1 className="mb-6 text-3xl font-bold">Admin Dashboard</h1>
          <p className="mb-8 text-white/70">This area is currently under development.</p>
          <Button className="rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 px-6">Coming Soon</Button>
        </div>
      </main>
    </div>
  )
}
