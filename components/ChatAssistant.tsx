'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Resizable, ResizeCallback } from 're-resizable'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Send, ChevronDown, ChevronUp, Search, Check } from 'lucide-react'
import { fetchGPTResponseStream } from '@/lib/api'
import { promptCards, categoryColors, PromptCard } from '@/lib/prompts'

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface LoadingIndicatorProps {
  progress: number;
  isComplete: boolean;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ progress, isComplete }) => {
  const radius = 20;
  const strokeWidth = 4;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress / 100 * circumference;

  return (
    <div className="absolute top-0 left-0">
      <svg
        height={radius * 2}
        width={radius * 2}
      >
        <circle
          stroke="#3b82f6"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      {isComplete && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-500 rounded-full">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
};

export default function ChatAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hallo! Wie kann ich Ihnen heute bei Ihren Immobilienaufgaben helfen?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCards, setExpandedCards] = useState<number[]>([]);
  const [chatHeight, setChatHeight] = useState(400);
  const chatWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const simulateProgress = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 100) {
        progress = 100;
        clearInterval(interval);
      }
      setLoadingProgress(progress);
    }, 200);
    return interval;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLoadingProgress(0);
    setIsLoadingComplete(false);

    const progressInterval = simulateProgress();

    try {
      let fullContent = '';
      for await (const chunk of fetchGPTResponseStream(input)) {
        fullContent += chunk;
      }
      
      clearInterval(progressInterval);
      setLoadingProgress(100);
      setIsLoadingComplete(true);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
      setIsLoading(false);
      setLoadingProgress(0);
      setIsLoadingComplete(false);
    } catch (error) {
      console.error('Error fetching GPT response:', error);
      clearInterval(progressInterval);
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: 'Entschuldigung, es gab einen Fehler bei der Verarbeitung Ihrer Anfrage. Bitte versuchen Sie es später erneut.'
        }
      ]);
      setIsLoading(false);
      setLoadingProgress(0);
      setIsLoadingComplete(false);
    }
  };

  const filteredCards = promptCards.filter(card => 
    card.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleCard = (id: number) => {
    setExpandedCards(prev => 
      prev.includes(id) ? prev.filter(cardId => cardId !== id) : [...prev, id]
    );
  };

  const handlePromptClick = (content: string) => {
    setInput(content);
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  const handleResize: ResizeCallback = (e, direction, ref, d) => {
    setChatHeight(chatHeight + d.height);
  };

  return (
    <div className="flex h-screen max-w-7xl mx-auto p-4 overflow-hidden">
      {/* Left sidebar with prompts */}
      <div className="w-1/4 pr-4 flex flex-col overflow-hidden">
        <div className="mb-4 relative">
          <Input
            type="text"
            placeholder="Suche nach Prompts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10"
          />
          <Search className="h-4 w-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
        <div className="overflow-y-auto flex-grow">
          {filteredCards.map(card => (
            <Card key={card.id} className="mb-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center space-x-2">
                  {React.createElement(card.icon, { className: "h-5 w-5" })}
                  <CardTitle className="text-xs font-medium">
                    {card.title}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCard(card.id)}
                >
                  {expandedCards.includes(card.id) ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {card.content}
                </p>
                {expandedCards.includes(card.id) && (
                  <div className="mt-2">
                    <p className="text-xs mb-2">{card.content}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handlePromptClick(card.content)}
                    >
                      Prompt verwenden
                    </Button>
                  </div>
                )}
                <div className="mt-2">
                  <span className={`text-xs font-semibold mr-2 px-2.5 py-0.5 rounded ${categoryColors[card.category]}`}>
                    {card.category}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Right side chat window */}
      <div className="w-3/4 flex flex-col">
        <Resizable
          size={{ width: '100%', height: chatHeight }}
          minHeight={300}
          maxHeight="80vh"
          onResizeStop={handleResize}
          enable={{ bottom: true }}
          handleComponent={{
            bottom: <div className="h-2 w-full cursor-ns-resize bg-gray-300 hover:bg-gray-400 transition-colors" />,
          }}
        >
          <div className="flex flex-col h-full border rounded-lg overflow-hidden">
            <div ref={chatWindowRef} className="flex-grow overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex items-start ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                  {message.role === 'assistant' && (
                    <div className="mr-2 flex-shrink-0 relative">
                      <Avatar>
                        <AvatarImage src="/placeholder.svg?height=40&width=40" alt="AI" />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                      {isLoading && index === messages.length - 1 && (
                        <LoadingIndicator progress={loadingProgress} isComplete={isLoadingComplete} />
                      )}
                    </div>
                  )}
                  <div className={`rounded-lg p-2 max-w-[80%] ${message.role === 'assistant' ? 'bg-gray-100' : 'bg-blue-500 text-white'} text-sm`}>
                    {formatMessage(message.content)}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start">
                  <div className="mr-2 flex-shrink-0 relative">
                    <Avatar>
                      <AvatarImage src="/placeholder.svg?height=40&width=40" alt="AI" />
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                    <LoadingIndicator progress={loadingProgress} isComplete={isLoadingComplete} />
                  </div>
                  <div className="rounded-lg p-2 max-w-[80%] bg-gray-100 text-sm">
                    Generiere Antwort...
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="p-4 border-t">
              <div className="flex items-center">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ihre Nachricht..."
                  className="flex-1 mr-2 text-sm"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading} className="bg-blue-500 hover:bg-blue-600 text-white font-sans">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </Resizable>
      </div>
    </div>
  )
}