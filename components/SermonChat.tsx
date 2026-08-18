import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, SermonSummaryOutput } from '../types';
import { streamSermonChat } from '../services/geminiService';
import { Send, User, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

interface SermonChatProps {
  summary: SermonSummaryOutput;
  onUpdateSummary: (updated: SermonSummaryOutput) => void;
}

export const SermonChat: React.FC<SermonChatProps> = ({ summary, onUpdateSummary }) => {
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages  = summary.chat_history || [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
    const history = [...messages, userMsg];
    
    // Add the user message and a placeholder for the assistant response
    const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
    onUpdateSummary({ ...summary, chat_history: [...history, assistantMsg] });
    
    setInput('');
    setLoading(true);
    setError(null);

    try {
      let fullReply = '';
      const stream = streamSermonChat(
        history.map(m => ({ role: m.role, content: m.content })),
        userMsg.content,
        summary.clean_transcript,
      );

      for await (const chunk of stream) {
        fullReply += chunk;
        // Update the last message in the history with the accumulated stream
        onUpdateSummary({ 
          ...summary, 
          chat_history: [...history, { role: 'assistant', content: fullReply, timestamp: Date.now() }] 
        });
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center space-x-3">
        <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950 rounded-xl flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Study Chat</p>
          <p className="text-xs text-slate-400">Ask anything about this sermon</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 dark:bg-slate-900/30">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8 py-12">
            <MessageCircle className="w-10 h-10 text-slate-200 dark:text-slate-700 mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-600">Ask me anything about today's sermon!</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] flex items-end space-x-2 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-emerald-600'}`}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
                </div>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm'}`}>
                  <div className="prose-chat">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                  <p className={`text-[10px] mt-1 opacity-50 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm text-slate-400 italic">
                Thinking…
              </div>
            </div>
          </motion.div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-xs font-medium flex items-center space-x-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-700">
        <form onSubmit={e => { e.preventDefault(); send(); }} className="relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask a question…"
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-4 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-100 placeholder:text-slate-400 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1.5 bottom-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold disabled:opacity-40 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
