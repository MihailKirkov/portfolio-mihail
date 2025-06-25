import type React from "react"
import "@/app/globals.css"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TranslationsProvider } from "@/components/translations-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Developer Portfolio | Mihail Kirkov",
  description: "Mihail Kirkov's Portfolio",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <TranslationsProvider>
              {children}
              <Toaster/>
            </TranslationsProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
