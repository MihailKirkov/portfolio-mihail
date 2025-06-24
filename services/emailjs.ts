// services/emailjs.ts
import emailjs from "emailjs-com";

export const sendEmail = async (
    e: React.FormEvent<HTMLFormElement>,
    onSuccess: () => void,
    onComplete: () => void,
    onError: (error: string) => void
) => {
    e.preventDefault();

    const form = e.currentTarget;
    console.log("form:",form)

    const NEXT_PUBLIC_EMAIL_JS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAIL_JS_SERVICE_ID;
    const NEXT_PUBLIC_EMAIL_JS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAIL_JS_TEMPLATE_ID;
    const NEXT_PUBLIC_EMAIL_JS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAIL_JS_PUBLIC_KEY;

    if (!NEXT_PUBLIC_EMAIL_JS_SERVICE_ID || !NEXT_PUBLIC_EMAIL_JS_TEMPLATE_ID || !NEXT_PUBLIC_EMAIL_JS_PUBLIC_KEY) {
        onError("Missing EmailJS environment variables.");
        return;
    }

    try {
        console.log('trying to sendForm')
        await emailjs.sendForm(
            NEXT_PUBLIC_EMAIL_JS_SERVICE_ID,
            NEXT_PUBLIC_EMAIL_JS_TEMPLATE_ID,
            form,
            NEXT_PUBLIC_EMAIL_JS_PUBLIC_KEY 
        );

        onSuccess();
    } catch (err: any) {
        console.error("[sendEmail] error: ", err);
        const errorMessage =
            err?.text ||
            err?.message ||
            "Failed to send message. Please try again later.";

        onError(errorMessage);
    } finally {
        console.log('finally')
        onComplete();
    }
};
