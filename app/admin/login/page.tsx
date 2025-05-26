'use client';

import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function handleLogin() {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken();

      document.cookie = `authToken=${token}; path=/;`;

      router.push("/admin/projects");
    } catch (err) {
      alert("Login failed");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-auto">
      <div className="space-y-4 w-full max-w-sm">
        <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <Button onClick={handleLogin}>Login</Button>
      </div>
    </div>
  );
}
