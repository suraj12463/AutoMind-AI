import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface CopilotProps {
  chatHistory: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const Copilot: React.FC<CopilotProps> = ({ chatHistory, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (!isLoading) {
      onSendMessage(suggestion);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-150px)] bg-brand-dark-2 rounded-lg border border-gray-700">
      <div className="flex-1 p-6 overflow-y-auto">
        {chatHistory.map((msg, index) => (
          <div key={index} className="mb-4">
            <div className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-brand-blue flex-shrink-0 flex items-center justify-center font-bold text-sm">
                  AI
                </div>
              )}
              <div
                className={`max-w-md p-3 rounded-lg ${
                  msg.sender === 'user'
                    ? 'bg-brand-blue text-white'
                    : 'bg-gray-700 text-gray-200'
                }`}
              >
                <p className="text-sm" dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g, '<br />') }} />
              </div>
            </div>
            {msg.sender === 'ai' && msg.suggestions && msg.suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 pl-11">
                {msg.suggestions.map((suggestion, sIndex) => (
                  <button
                    key={sIndex}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-sm bg-gray-700 text-brand-blue font-semibold py-1.5 px-3 rounded-full hover:bg-gray-600 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-blue flex-shrink-0 flex items-center justify-center font-bold text-sm">
              AI
            </div>
            <div className="max-w-md p-3 rounded-lg bg-gray-700 text-gray-200">
              <div className="flex items-center space-x-1">
                  <span className="text-sm">AutoMind is thinking</span>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse-fast [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse-fast [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse-fast"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="p-4 border-t border-gray-700">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask 'How to change the oil on a 2015 Honda Civic?'"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-brand-blue text-white font-bold py-2 px-5 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default Copilot;