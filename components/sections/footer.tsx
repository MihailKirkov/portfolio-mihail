import { Code2, Github, Linkedin, Twitter } from 'lucide-react'
import Link from 'next/link'
import React from 'react'
import { Button } from '../ui/button'

const Footer = () => {
    return (
        <footer className="border-t border-white/10 py-8">
            <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                <p className="text-sm font-light">
                © {new Date().getFullYear()} <span className="font-bold">Mihail</span>K. All rights reserved.
                </p>
            </div>
            <div className="flex gap-4">
                <Link href="https://github.com/MihailKirkov" target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <Github className="h-4 w-4" />
                        <span className="sr-only">GitHub</span>
                    </Button>
                </Link>
                <Link href="https://www.linkedin.com/in/mihail-kirkov-b65b36262/" target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <Linkedin className="h-4 w-4" />
                        <span className="sr-only">LinkedIn</span>
                    </Button>
                </Link>
            </div>
            </div>
        </footer>
    )
}

export default Footer