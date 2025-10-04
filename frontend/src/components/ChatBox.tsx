'use client';

import { useState, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import type { ChatMessage } from '@/types';

interface ChatBoxProps {
  datasetId: string;
}

export default function ChatBox({ datasetId }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const storageKey = `chat-history-${datasetId}`;
    const savedMessages = localStorage.getItem(storageKey);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed);
      } catch (error) {
        console.error('Failed to parse saved chat history:', error);
      }
    }
  }, [datasetId]);

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      const storageKey = `chat-history-${datasetId}`;
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, datasetId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await apiClient.chat(datasetId, input.trim());
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      let errorContent = 'Failed to get response';
      
      if (error instanceof Error) {
        errorContent = error.message;
        // Check for 404 error (dataset not found)
        if (errorContent.includes('404') || errorContent.includes('not found')) {
          errorContent = '⚠️ Dataset not found. The backend may have been restarted. Please re-upload your dataset to continue chatting.';
        }
      }
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Error: ${errorContent}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    const storageKey = `chat-history-${datasetId}`;
    localStorage.removeItem(storageKey);
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-12rem)]">
      <div className="p-3 sm:p-4 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold">Ask About Your Dataset</h3>
        {messages.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="text-xs text-white/40 hover:text-white/80 transition-colors px-2 py-1 hover:bg-white/5 rounded"
            title="Clear chat history"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-white/40 mt-8">
            <p>Start a conversation about your dataset</p>
            <p className="text-sm mt-2">
              Try asking: &quot;What are the main clusters?&quot; or &quot;Explain cluster 2&quot;
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-2.5 sm:p-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white'
              }`}
            >
              <p className="text-xs sm:text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-[10px] sm:text-xs opacity-60 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 sm:p-4 border-t border-[#333]">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your dataset..."
            disabled={loading}
            className="flex-1 bg-white/5 border border-[#333] rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base text-white placeholder-white/40 focus:outline-none focus:border-white/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-white/10 disabled:text-white/40 rounded-lg font-medium transition-colors text-sm sm:text-base"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

