import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Loader2, Sparkles, LogOut, LogIn, Plus, MessageSquare, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc
} from './lib/firebase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: any;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: any;
  userId: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "কিছু ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          displayMessage = "আপনার এই তথ্য দেখার অনুমতি নেই।";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white/5 border border-white/10 p-10 rounded-[2.5rem] space-y-6">
            <X size={48} className="text-red-500 mx-auto" />
            <h1 className="text-2xl font-bold">ত্রুটি!</h1>
            <p className="text-white/60">{displayMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-500 transition-all"
            >
              আবার চেষ্টা করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              createdAt: new Date().toISOString()
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setCurrentSessionId(null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Sessions Listener
  useEffect(() => {
    if (!user) return;

    const sessionsRef = collection(db, 'users', user.uid, 'chats');
    const q = query(sessionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sess = snapshot.docs.map(doc => doc.data() as ChatSession);
      setSessions(sess);
      
      // If no session selected, select the most recent one
      if (sess.length > 0 && !currentSessionId) {
        setCurrentSessionId(sess[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/chats`);
    });

    return () => unsubscribe();
  }, [user, currentSessionId]);

  // Messages Listener
  useEffect(() => {
    if (!user || !currentSessionId) {
      setMessages([]);
      return;
    }

    const messagesRef = collection(db, 'users', user.uid, 'chats', currentSessionId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => doc.data() as Message);
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/chats/${currentSessionId}/messages`);
    });

    return () => unsubscribe();
  }, [user, currentSessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const createNewChat = async () => {
    if (!user) return;
    
    const sessionsRef = collection(db, 'users', user.uid, 'chats');
    const newSessionRef = doc(sessionsRef);
    const newSession: ChatSession = {
      id: newSessionRef.id,
      title: 'নতুন চ্যাট',
      createdAt: serverTimestamp(),
      userId: user.uid
    };
    
    try {
      await setDoc(newSessionRef, newSession);
      setCurrentSessionId(newSessionRef.id);
      setIsSidebarOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/chats/${newSessionRef.id}`);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    let sessionId = currentSessionId;
    
    // Create a session if none exists
    if (!sessionId) {
      const sessionsRef = collection(db, 'users', user.uid, 'chats');
      const newSessionRef = doc(sessionsRef);
      sessionId = newSessionRef.id;
      try {
        await setDoc(newSessionRef, {
          id: sessionId,
          title: input.slice(0, 30) + (input.length > 30 ? '...' : ''),
          createdAt: serverTimestamp(),
          userId: user.uid
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/chats/${sessionId}`);
      }
      setCurrentSessionId(sessionId);
    } else {
      // Update title if it's the first message
      if (messages.length === 0) {
        const sessionRef = doc(db, 'users', user.uid, 'chats', sessionId);
        try {
          await updateDoc(sessionRef, {
            title: input.slice(0, 30) + (input.length > 30 ? '...' : '')
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/chats/${sessionId}`);
        }
      }
    }

    const userMessageContent = input;
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);

    try {
      const messagesRef = collection(db, 'users', user.uid, 'chats', sessionId, 'messages');
      await addDoc(messagesRef, {
        role: 'user',
        content: userMessageContent,
        timestamp: serverTimestamp(),
        userId: user.uid
      });

      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: userMessageContent });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessageContent, 
          stream: true,
          history: history
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

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
            } catch (e) {
              console.error('Error parsing stream chunk', e);
            }
          }
        }
      }

      await addDoc(messagesRef, {
        role: 'assistant',
        content: assistantContent,
        timestamp: serverTimestamp(),
        userId: user.uid
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/chats/${sessionId}/messages`);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  if (!authReady) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white/5 border border-white/10 p-10 rounded-[2.5rem] space-y-8"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/20">
            <Bot size={40} className="text-white" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">স্বাগতম!</h1>
            <p className="text-white/40 leading-relaxed">
              আপনার এআই এজেন্টের সাথে কথা বলতে এবং ইতিহাস সংরক্ষণ করতে লগইন করুন।
            </p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-4 rounded-2xl hover:bg-white/90 transition-all active:scale-[0.98]"
          >
            <LogIn size={20} />
            গুগল দিয়ে লগইন করুন
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-[#111111] border-r border-white/10 z-50 transition-transform duration-300 transform lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-4">
          <button
            onClick={createNewChat}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-medium mb-6"
          >
            <Plus size={18} />
            নতুন চ্যাট
          </button>

          <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  setCurrentSessionId(session.id);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all text-sm text-left group",
                  currentSessionId === session.id 
                    ? "bg-white/10 text-white" 
                    : "text-white/40 hover:bg-white/5 hover:text-white"
                )}
              >
                <MessageSquare size={16} className="flex-shrink-0" />
                <span className="truncate">{session.title}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-white/10">
            <div className="flex items-center gap-3 px-2 py-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-sm font-bold">
                {user.displayName?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName}</p>
                <p className="text-[10px] text-white/30 truncate">{user.email}</p>
              </div>
              <button onClick={handleLogout} className="p-2 text-white/30 hover:text-white transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-white/5 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">ওপেনরাউটার এজেন্ট</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-white/50 font-medium uppercase tracking-wider">
                  {sessions.find(s => s.id === currentSessionId)?.title || 'নতুন চ্যাট'}
                </span>
              </div>
            </div>
          </div>
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
                আমি ওপেনরাউটার দ্বারা চালিত আপনার প্রোডাকশন-রেডি এআই এজেন্ট। আমাকে যেকোনো কিছু জিজ্ঞাসা করুন।
              </p>
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
    </div>
  </ErrorBoundary>
);
}
