"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { useChatStream } from "@/hooks/useChatStream";
import SuggestRow from "@/components/chat/suggest-row";
import MessageList from "@/components/chat/message-list";
import ChatInput from "@/components/chat/chat-input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const SUGGESTED = [
  "How many years of experience do you have?",
  "Can you list your main technical skills?",
  "Tell me about one of your favorite projects.",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, input, setInput, loading, send, cancel } = useChatStream();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  return (
    <>
      {/* Launcher */}
<div className="fixed right-4 bottom-4 z-50">
    {!open && (
      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Button
                size="icon"
                className="h-12 w-12 rounded-full shadow-xl"
                onClick={() => setOpen(true)}
                aria-label="AI Chat"
              >
                <motion.span whileTap={{ scale: 0.95 }}>
                  <MessageCircle className="h-5 w-5" />
                </motion.span>
              </Button>
            </motion.div>
          </TooltipTrigger>

          {/* You can change side/offset */}
          <TooltipContent side="left" sideOffset={8}>
            AI Chat
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )}
  </div>
    

      {/* Panel with animation */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="chat-panel"
            className="fixed right-4 bottom-4 z-50 w-[92vw] max-w-md"
            initial={{ opacity: 0, y: 24, scale: 0.96, transformOrigin: "bottom right" }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: "spring", stiffness: 380, damping: 26, mass: 0.8 },
            }}
            exit={{
              opacity: 0,
              y: 16,
              scale: 0.98,
              transition: { duration: 0.18, ease: "easeInOut" },
            }}
          >
            <motion.div layout>
              <Card className="shadow-2xl border will-change-transform">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="text-sm font-medium">
                    MIH<b className="text-cyan-400">AI</b>L Chat Bot
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      cancel();
                      setOpen(false);
                    }}
                    aria-label="Close chat"
                    asChild
                  >
                    <motion.span whileTap={{ scale: 0.95 }}>
                      <X className="h-4 w-4" />
                    </motion.span>
                  </Button>
                </div>

                <CardContent className="p-0">
                  <ScrollArea className="h-[420px] p-4">
                    {messages.length === 1 && !loading && (
                      <SuggestRow items={SUGGESTED} disabled={false} onSelect={(t) => send(t)} />
                    )}
                    <MessageList messages={messages} bottomRef={bottomRef} />
                  </ScrollArea>

                  <ChatInput
                    value={input}
                    onChange={setInput}
                    onSend={() => send()}
                    disabled={loading}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
