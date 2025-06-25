import { useEffect, useState } from "react";

export function useBreakpoint() {
    const [breakpoint, setBreakpoint] = useState<"sm" | "md" | "lg">("sm");

    useEffect(() => {
        function updateBreakpoint() {
        const width = window.innerWidth;
        if (width < 768) setBreakpoint("sm");
        else if (width < 1024) setBreakpoint("md");
        else setBreakpoint("lg");
        }

        updateBreakpoint();
        window.addEventListener("resize", updateBreakpoint);
        return () => window.removeEventListener("resize", updateBreakpoint);
    }, []);

    return breakpoint;
}
