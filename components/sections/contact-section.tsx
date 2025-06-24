"use client";

import { Github, Linkedin, Mail } from "lucide-react";
import React, { useRef, useState } from "react";
import { Button } from "../ui/button";
import { sendEmail } from "@/services/emailjs";
import { toast } from "sonner";

const ContactSection = () => {
    const [loading, setLoading] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); // Prevent default behavior
        setLoading(true);
        sendEmail(
            e,
            () => {
                toast.success("Message sent successfully!");
                formRef.current?.reset(); // ✅ Clear the form
                setLoading(false); // ✅ Stop loading after success
            },
            () => setLoading(false),
            (err: string) => {
                console.error("Error:", err);
                toast.error(err);
                setLoading(false);
            }
        );
    };

    return (
        <section id="contact" className="bg-gradient-to-b from-gray-900 to-black py-32">
            <div className="container">
                <div className="mb-16 flex flex-col items-center">
                    <h2 className="text-5xl font-bold tracking-tighter">Get In Touch</h2>
                    <div className="mt-2 h-1 w-20 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"></div>
                </div>
                <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
                    <div className="mb-8 grid gap-8 md:grid-cols-3">
                        <ContactCard icon={<Mail />} label="Email" value="mihailkirkov04@gmail.com" color="purple" />
                        <ContactCard icon={<Github />} label="GitHub" value="@MihailKirkov" color="cyan" />
                        <ContactCard icon={<Linkedin />} label="LinkedIn" value="@Mihail-Kirkov" color="purple" />
                    </div>
                    <form ref={formRef} className="space-y-6" onSubmit={handleSubmit}>
                        <div className="grid gap-6 md:grid-cols-2">
                            <InputField id="name" label="Name" type="text" placeholder="Your name" />
                            <InputField id="email" label="Email" type="email" placeholder="Your email" />
                        </div>
                        <InputField id="subject" label="Subject" type="text" placeholder="Subject" />
                        <TextAreaField id="message" label="Message" placeholder="Your message" />
                        <Button
                            type="submit"
                            className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-cyan-500 py-6 text-white"
                            disabled={loading}
                        >
                            {loading ? "Sending..." : "Send Message"}
                        </Button>
                    </form>
                </div>
            </div>
        </section>
    );
};

const ContactCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: "purple" | "cyan" }) => (
    <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <div className={`mb-4 rounded-full bg-${color}-500/20 p-3`}>{icon}</div>
        <h3 className="mb-2 text-lg font-medium">{label}</h3>
        <p className="text-sm text-white/70">{value}</p>
    </div>
);

const InputField = ({ id, label, type, placeholder }: { id: string; label: string; type: string; placeholder: string }) => (
    <div className="space-y-2">
        <label htmlFor={id} className="text-sm font-light">
            {label}
        </label>
        <input
            id={id}
            name={id}
            type={type}
            placeholder={placeholder}
            required
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white backdrop-blur-sm focus:border-purple-500 focus:outline-none"
        />
    </div>
);

const TextAreaField = ({ id, label, placeholder }: { id: string; label: string; placeholder: string }) => (
    <div className="space-y-2">
        <label htmlFor={id} className="text-sm font-light">
            {label}
        </label>
        <textarea
            id={id}
            name={id}
            placeholder={placeholder}
            required
            className="h-32 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white backdrop-blur-sm focus:border-purple-500 focus:outline-none"
        />
    </div>
);

export default ContactSection;