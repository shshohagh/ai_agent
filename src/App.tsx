import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, stream: true }),
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const { content } = JSON.parse(data);
              assistantContent += content;
              setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].content = assistantContent;
                return newMessages;
              });
            } catch (e) {
              console.error('Error parsing stream chunk', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please check your API key and try again.' }]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const clearHistory = async () => {
    try {
      await fetch('/api/clear', { method: 'POST' });
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear history', error);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">OpenRouter Agent</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-white/50 font-medium uppercase tracking-wider">Online</span>
            </div>
          </div>
        </div>
        <button 
          onClick={clearHistory}
          className="p-2.5 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all active:scale-95"
          title="Clear History"
        >
          <Trash2 size={20} />
        </button>
      </header>

      {/* Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-8 space-y-8 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-2">
              <Sparkles size={40} className="text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold">আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?</h2>
            <p className="text-white/40 leading-relaxed">
              আমি ওপেনরাউটার দ্বারা চালিত আপনার প্রোডাকশন-রেডি এআই এজেন্ট। আমাকে যেকোনো কিছু জিজ্ঞাসা করুন বা একটি জটিল কাজ করার চেষ্টা করুন।
            </p>
            <div className="grid grid-cols-1 gap-3 w-full">
              {['কোয়ান্টাম কম্পিউটিং কী?', 'একটি রিঅ্যাক্ট হুক লিখুন', 'একটি ভ্রমণের পরিকল্পনা করতে সাহায্য করুন'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); }}
                  className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-sm text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    "flex gap-4",
                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-1",
                    msg.role === 'user' ? "bg-indigo-600" : "bg-white/10"
                  )}>
                    {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                  </div>
                  <div className={cn(
                    "max-w-[85%] px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-indigo-600 text-white rounded-tr-none" 
                      : "bg-white/5 border border-white/10 text-white/90 rounded-tl-none"
                  )}>
                    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && !isStreaming && (
              <div className="flex gap-4 max-w-3xl mx-auto">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center animate-pulse">
                  <Bot size={18} className="text-white/40" />
                </div>
                <div className="bg-white/5 border border-white/10 px-5 py-3.5 rounded-2xl rounded-tl-none">
                  <Loader2 size={18} className="animate-spin text-white/40" />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-6 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
        <form 
          onSubmit={handleSend}
          className="max-w-3xl mx-auto relative group"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ওপেনরাউটার এজেন্টকে মেসেজ করুন..."
            disabled={isLoading}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-white/20"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-white/20 transition-all active:scale-95"
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </form>
        <p className="text-center text-[11px] text-white/20 mt-4 uppercase tracking-[0.2em] font-medium">
          Powered by OpenRouter & Node.js
        </p>
      </footer>
    </div>
  );
}
