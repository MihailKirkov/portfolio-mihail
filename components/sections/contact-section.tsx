import { Github, Linkedin, Mail } from 'lucide-react';
import React from 'react'
import { Button } from '../ui/button';

const ContactSection = () => {
    return (
        <section id="contact" className="bg-gradient-to-b from-gray-900 to-black py-32">
            <div className="container">
            <div className="mb-16 flex flex-col items-center">
                <h2 className="text-5xl font-bold tracking-tighter">Get In Touch</h2>
                <div className="mt-2 h-1 w-20 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"></div>
            </div>
            <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
                <div className="mb-8 grid gap-8 md:grid-cols-3">
                <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                    <div className="mb-4 rounded-full bg-purple-500/20 p-3">
                    <Mail className="h-6 w-6 text-purple-500" />
                    </div>
                    <h3 className="mb-2 text-lg font-medium">Email</h3>
                    <p className="text-sm text-white/70">mihailkirkov04@gmail.com</p>
                </div>
                <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                    <div className="mb-4 rounded-full bg-cyan-500/20 p-3">
                    <Github className="h-6 w-6 text-cyan-500" />
                    </div>
                    <h3 className="mb-2 text-lg font-medium">GitHub</h3>
                    <p className="text-sm text-white/70">@MihailKirkov</p>
                </div>
                <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                    <div className="mb-4 rounded-full bg-purple-500/20 p-3">
                    <Linkedin className="h-6 w-6 text-purple-500" />
                    </div>
                    <h3 className="mb-2 text-lg font-medium">LinkedIn</h3>
                    <p className="text-sm text-white/70">@Mihail-Kirkov</p>
                </div>
                </div>
                <form className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-light">
                        Name
                    </label>
                    <input
                        id="name"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white backdrop-blur-sm focus:border-purple-500 focus:outline-none"
                        type="text"
                        placeholder="Your name"
                    />
                    </div>
                    <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-light">
                        Email
                    </label>
                    <input
                        id="email"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white backdrop-blur-sm focus:border-purple-500 focus:outline-none"
                        type="email"
                        placeholder="Your email"
                    />
                    </div>
                </div>
                <div className="space-y-2">
                    <label htmlFor="subject" className="text-sm font-light">
                    Subject
                    </label>
                    <input
                    id="subject"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white backdrop-blur-sm focus:border-purple-500 focus:outline-none"
                    type="text"
                    placeholder="Subject"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-light">
                    Message
                    </label>
                    <textarea
                    id="message"
                    className="h-32 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white backdrop-blur-sm focus:border-purple-500 focus:outline-none"
                    placeholder="Your message"
                    ></textarea>
                </div>
                <Button className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 py-6 text-white">
                    Send Message
                </Button>
                </form>
            </div>
            </div>
        </section>
    )
}

export default ContactSection;