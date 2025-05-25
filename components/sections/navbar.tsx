import React from 'react'
import Link from 'next/link';
import { Button } from '../ui/button';

const Navbar = () => {
    return (
        <header className="fixed top-0 z-50 w-full border-b border-white/10 backdrop-blur-md">
            <div className="container flex h-16 items-center justify-between">
                <Link href="/" className="text-xl font-light tracking-wider text-cyan-500">
                <span className="font-bold text-primary">Mihail</span>K
                </Link>
                <nav className="hidden space-x-8 md:flex">
                <Link href="#about" className="text-sm font-light tracking-wider hover:text-primary transition-colors scroll-smooth">
                    About
                </Link>
                <Link href="#projects" className="text-sm font-light tracking-wider hover:text-primary transition-colors">
                    Projects
                </Link>
                <Link href="#experience" className="text-sm font-light tracking-wider hover:text-primary transition-colors">
                    Experience
                </Link>
                <Link href="#contact" className="text-sm font-light tracking-wider hover:text-primary transition-colors">
                    Contact
                </Link>
                </nav>
                <Button
                variant="ghost"
                className="rounded-full border border-white/20 px-6 text-xs font-light tracking-wider"
                >
                Resume
                </Button>
            </div>
        </header>
    )
}

export default Navbar