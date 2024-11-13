// app/chat/page.tsx
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import YouTube from 'react-youtube';
import { ArrowRight, PlusCircle, HelpCircle, BookOpen, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { getUserId } from '@/app/utils/user';
// Types
interface ConversationVideo {
  id: string;
  url: string;
}

interface ConversationProduct {
  title: string;
  link: string;
}

interface Conversation {
  question: string;
  text: string;
  initial_answer?: string;
  video?: string[];
  videoLinks?: Record<string, string[]>;
  products?: ConversationProduct[];
  timestamp: string;
}

interface Session {
  id: string;
  conversations: Conversation[];
}

// YouTube video ID extractor
const getYoutubeVideoIds = (urls: string[]): string[] => {
  if (!urls || urls.length === 0) return [];
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  return urls.map(url => {
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }).filter((id): id is string => id !== null);
};

export default function ChatPage() {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentConversation, setCurrentConversation] = useState<Conversation[]>([]);
  const [conversationHistory, setConversationHistory] = useState<Record<string, Conversation[]>>({
    "bents": [],
    "shop-improvement": [],
    "tool-recommendations": []
  });
  const [showInitialQuestions, setShowInitialQuestions] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingQuestionIndex, setLoadingQuestionIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<string>("bents");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCenterSearch, setShowCenterSearch] = useState(true);
  const [randomQuestions, setRandomQuestions] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Refs
  const latestConversationRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sorted sessions memoization
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aDate = a.conversations && a.conversations.length > 0 
        ? new Date(a.conversations[0].timestamp) 
        : new Date(0);
      const bDate = b.conversations && b.conversations.length > 0 
        ? new Date(b.conversations[0].timestamp) 
        : new Date(0);
      return bDate.getTime() - aDate.getTime();
    });
  }, [sessions]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const userId = getUserId();
        const [sessionsResponse, questionsResponse] = await Promise.all([
          axios.get<Session[]>(`${process.env.NEXT_PUBLIC_API_URL}/api/get-session/${userId}`),
          axios.get<{ question_text: string }[]>(`${process.env.NEXT_PUBLIC_API_URL}/api/random-questions`)
        ]);

        const storedSessions = sessionsResponse.data || [];
        setSessions(storedSessions);

        if (storedSessions.length === 0 || storedSessions[storedSessions.length - 1].conversations.length > 0) {
          const newSessionId = uuidv4();
          const newSession: Session = { id: newSessionId, conversations: [] };
          setSessions([...storedSessions, newSession]);
          setCurrentSessionId(newSessionId);
        } else {
          setCurrentSessionId(storedSessions[storedSessions.length - 1].id);
        }

        setRandomQuestions(questionsResponse.data.map(q => q.question_text));
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };

    fetchInitialData();
    initializeLocalStorage();
  }, []);

  useEffect(() => {
    const saveConversationHistory = async () => {
      if (isInitialized) {
        try {
          const userId = getUserId();
          localStorage.setItem(`conversationHistory-${userId}`, JSON.stringify(conversationHistory));
          localStorage.setItem(`selectedIndex-${userId}`, selectedIndex);
        } catch (error) {
          console.error("Error saving conversation history:", error);
        }
      }
    };

    saveConversationHistory();
  }, [conversationHistory, selectedIndex, isInitialized]);

  useEffect(() => {
    const saveSessions = async () => {
      if (sessions.length > 0) {
        try {
          const userId = getUserId();
          const optimizedSessions = sessions.map(session => ({
            id: session.id,
            conversations: session.conversations.map(conv => ({
              question: conv.question,
              text: conv.text,
              video: conv.video || [],
              videoLinks: conv.videoLinks || {}
            }))
          }));

          await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/save-session`, {
            userId,
            sessionData: optimizedSessions
          });
        } catch (error) {
          console.error("Error saving sessions:", error);
        }
      }
    };

    saveSessions();
  }, [sessions]);

  const initializeLocalStorage = () => {
    const userId = getUserId();
    const storedHistory = localStorage.getItem(`conversationHistory-${userId}`);
    const storedIndex = localStorage.getItem(`selectedIndex-${userId}`);

    if (storedHistory && storedIndex) {
      try {
        setConversationHistory(JSON.parse(storedHistory));
        setSelectedIndex(storedIndex);
      } catch (error) {
        console.error("Error parsing stored conversation history:", error);
        resetConversationHistory();
      }
    } else {
      resetConversationHistory();
    }
    setIsInitialized(true);
  };

  const resetConversationHistory = () => {
    const defaultHistory = {
      "bents": [],
      "shop-improvement": [],
      "tool-recommendations": []
    };
    setConversationHistory(defaultHistory);
    setSelectedIndex("bents");
  };



  const handleSearch = async (
    e: React.FormEvent<HTMLFormElement> | React.MouseEvent, 
    initialQuestionIndex: number | null = null
  ) => {
    e.preventDefault();
    
    const query = initialQuestionIndex !== null ? randomQuestions[initialQuestionIndex] : searchQuery;
    if (!query?.trim() || isSearching) return;
    
    setIsSearching(true);
    setIsLoading(true);
    setLoadingQuestionIndex(initialQuestionIndex);
  
    try {
      const response = await axios.post('/api/chat', {
        message: query,
        selected_index: selectedIndex,
        chat_history: currentConversation.flatMap(conv => [
          conv.question,
          conv.initial_answer || conv.text
        ])
      }, {
       timeout: 300000, // 300 seconds (5 minutes) timeout
      });

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      const newConversation: Conversation = {
        question: query,
        text: response.data.response,
        initial_answer: response.data.initial_answer,
        video: response.data.urls || [],
        videoLinks: response.data.video_links || {},
        timestamp: new Date().toISOString()
      };

      setCurrentConversation(prev => [...prev, newConversation]);
      
      // Update sessions
      setSessions(prevSessions => 
        prevSessions.map(session => 
          session.id === currentSessionId 
            ? { ...session, conversations: [...session.conversations, newConversation] }
            : session
        )
      );

      setShowInitialQuestions(false);
      setSearchQuery("");
      setShowCenterSearch(false);
      
      setTimeout(scrollToLatestConversation, 100);
    } catch (error: any) {
      console.error("Error fetching response:", error);
      setCurrentConversation(prev => [...prev, {
        question: query,
        text: `Error: ${error.response?.data?.message || 'Failed to get response. Please try again.'}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
      setLoadingQuestionIndex(null);
      setIsSearching(false);
    }
  };







  const handleNewSession = () => {
    const newSessionId = uuidv4();
    const newSession: Session = { id: newSessionId, conversations: [] };
    setSessions(prevSessions => [...prevSessions, newSession]);
    setCurrentSessionId(newSessionId);
    setCurrentConversation([]);
    setShowInitialQuestions(true);
    setShowCenterSearch(true);
  };

  const handleSectionChange = (newIndex: string) => {
    setSelectedIndex(newIndex);
    setIsDropdownOpen(false);
    setCurrentConversation([]);
    setSelectedConversation(null);
    setShowInitialQuestions(true);
    setShowCenterSearch(true);
  };

  const updateConversationAndSession = (newConversation: Conversation) => {
    setCurrentConversation(prev => [...prev, newConversation]);
    setSessions(prevSessions => 
      prevSessions.map(session => 
        session.id === currentSessionId
          ? { ...session, conversations: [...session.conversations, newConversation] }
          : session
      )
    );
  };

  const scrollToLatestConversation = () => {
    latestConversationRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const resetSearchState = () => {
    setShowInitialQuestions(false);
    setSearchQuery("");
    setShowCenterSearch(false);
    setTimeout(scrollToLatestConversation, 100);
  };

  const renderVideos = (videos?: string[], videoLinks?: Record<string, string[]>) => {
    const videoIds = new Set<string>();
    
    if (videos?.length) {
      getYoutubeVideoIds(videos).forEach(id => videoIds.add(id));
    }

    if (videoLinks) {
      const allVideoUrls = Object.values(videoLinks).flat();
      getYoutubeVideoIds(allVideoUrls).forEach(id => videoIds.add(id));
    }

    if (!videoIds.size) return null;

    const opts = {
      height: '195',
      width: '320',
      playerVars: { autoplay: 0 }
    };

    return (
      <div className="flex flex-wrap gap-4 mb-4">
        {Array.from(videoIds).map(videoId => (
          <YouTube key={videoId} videoId={videoId} opts={opts} />
        ))}
      </div>
    );
  };

  const formatResponse = (text: string, videoLinks?: Record<string, string[]>) => {
    if (!text) return null;

    let formattedText = text;

    if (videoLinks) {
      formattedText = text.replace(/\[video(\d+)\]/g, (match, p1) => {
        const links = videoLinks[`[video${p1}]`];
        return links?.[0] 
          ? `<a href="${links[0]}" target="_blank" rel="noopener noreferrer" class="video-link text-blue-500 hover:underline">Video</a>`
          : match;
      });
    }

    formattedText = formattedText
      .replace(/(\d+)\.\s*\*\*(.*?)\*\*(:?)\s*([-\s]*)(.+)/g, 
        (_, number, title, colon, dash, content) => 
          `<div class="font-bold mt-2 mb-1">${number}. ${title}${colon}</div><div class="ml-4">${dash}${content}</div>`)
      .replace(/\*\*\*\*timestamp\*\*\*\*\s*(\[video\d+\])/g, '$1')
      .replace(/^(\#{1,6})\s*\*\*(.*?)\*\*/gm, '$1 <strong>$2</strong>');

    return <div dangerouslySetInnerHTML={{ __html: formattedText }} />;
  };

  const renderDropdownMenu = () => (
    <div ref={dropdownRef} className="absolute bottom-full left-0 mb-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
      <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
        {[
          { value: "bents", label: "All" },
          { value: "shop-improvement", label: "Shop Improvement" },
          { value: "tool-recommendations", label: "Tool Recommendations" }
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => handleSectionChange(option.value)}
            className={`block px-4 py-2 text-sm w-full text-left ${
              selectedIndex === option.value
                ? "bg-blue-500 text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderSearchBar = () => (
    <div className="flex items-center w-full">
      <div className="flex-grow flex items-center border rounded-md bg-white shadow-sm">
        <Button
          onClick={handleNewSession}
          className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
          title="New Conversation"
        >
          <PlusCircle size={20} />
        </Button>
        
        <div className="relative" ref={dropdownRef}>
          <Button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <HelpCircle size={20} />
          </Button>
          {isDropdownOpen && renderDropdownMenu()}
        </div>
        
        <div className="h-6 w-px bg-gray-300 mx-2"></div>
        
        <form onSubmit={handleSearch} className="flex-grow flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ask a question..."
            className="flex-grow p-2 focus:outline-none"
          />
          <button
            type="submit"
            className={`p-2 text-gray-500 hover:text-gray-700 focus:outline-none ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? <span className="animate-spin">⌛</span> : <ArrowRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );

  const renderSidebar = () => (
    <>
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsSidebarOpen(false)}></div>
      )}
      <div 
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out z-50 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 h-full overflow-y-auto">
          <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 z-10">
            <X size={24} />
          </button>
          <h2 className="text-xl font-bold mb-4 mt-8">Sessions</h2>
          {sortedSessions.map((session) => (
            <div
              key={session.id}
              className="cursor-pointer hover:bg-gray-100 p-2 rounded mb-2"
              onClick={() => {
                setCurrentSessionId(session.id);
                setCurrentConversation(session.conversations);
                setShowInitialQuestions(false);
                setShowCenterSearch(false);
                setIsSidebarOpen(false);
              }}
            >
              {session.conversations && session.conversations.length > 0 ? (
                <p className="text-sm truncate">{session.conversations[0].question}</p>
              ) : (
                <p className="text-sm italic text-gray-500">Empty session</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const renderInitialQuestions = () => (
    <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {randomQuestions.map((question, index) => (
        <button
          key={index}
          onClick={(e) => handleSearch(e, index)}
          className="p-4 border rounded-lg hover:bg-gray-100 text-center h-full flex items-center justify-center transition-colors duration-200 ease-in-out relative"
          disabled={isSearching || isLoading || loadingQuestionIndex !== null}
        >
          {loadingQuestionIndex === index ? (
            <span className="animate-spin absolute">⌛</span>
          ) : (
            <span>{question}</span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-white">
      <div className="flex flex-col h-screen bg-white">
        {/* Sidebar */}
        {renderSidebar()}
        
        {/* Main content */}
        <div className="relative flex-grow overflow-hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-[85px] left-4 z-30 bg-white px-4 py-2 rounded-full shadow-md hover:bg-gray-100 transition-colors duration-200 flex items-center space-x-2"
            title="Open Sessions"
          >
            <BookOpen size={20} />
            <span className="font-medium">History</span>
          </button>
          
          <div className="h-full overflow-y-auto p-4 pt-16 pb-20">
            {currentConversation.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <h2 className="text-3xl font-bold mb-8">A question creates knowledge</h2>
                <div className="w-full max-w-3xl mb-8">
                  {renderSearchBar()}
                </div>
                {showInitialQuestions && renderInitialQuestions()}
              </div>
            ) : (
              <div>
                {currentConversation.map((conv, index) => (
                  <div 
                    key={index} 
                    ref={index === currentConversation.length - 1 ? latestConversationRef : null}
                    className="bg-white p-4 rounded-lg shadow mb-4"
                  >
                    <h2 className="font-bold mb-4">{conv.question}</h2>
                    <div className="mb-4">
                      {renderVideos(conv.video, conv.videoLinks)}
                      {formatResponse(conv.text, conv.videoLinks)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom search bar */}
        {currentConversation.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 flex justify-center p-4 bg-white border-t border-gray-200">
            <div className="w-full max-w-3xl">
              {renderSearchBar()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
