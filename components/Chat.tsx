'use client'

import { useState, useRef, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useUser } from '@clerk/clerk-react';
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';
import YouTube from 'react-youtube';
import { BookOpen } from 'lucide-react';
import Image from 'next/image';

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

interface ChatProps {
  isVisible: boolean;
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

const Chat: React.FC<ChatProps> = ({ isVisible }) => {
  const { isSignedIn, user } = useUser();
  const router = useRouter();
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
    if (!isSignedIn) {
      router.push('/login');
      return;
    }

    const fetchInitialData = async () => {
      try {
        const [sessionsResponse, questionsResponse] = await Promise.all([
          axios.get<Session[]>(`${process.env.NEXT_PUBLIC_API_URL}/api/get-session/${user?.id}`),
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
  }, [isSignedIn, user, router]);

  const initializeLocalStorage = () => {
    if (!user?.id) return;

    const storedHistory = localStorage.getItem(`conversationHistory-${user.id}`);
    const storedIndex = localStorage.getItem(`selectedIndex-${user.id}`);

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
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        message: query,
        selected_index: selectedIndex,
        chat_history: currentConversation.map(conv => ({
          question: conv.question,
          answer: conv.initial_answer || conv.text
        }))
      });

      const newConversation: Conversation = {
        question: query,
        text: response.data.response,
        initial_answer: response.data.initial_answer,
        video: response.data.urls || [],
        videoLinks: response.data.video_links || {},
        timestamp: new Date().toISOString()
      };

      updateConversationAndSession(newConversation);
      resetSearchState();
    } catch (error) {
      console.error("Error fetching response:", error);
    } finally {
      setIsLoading(false);
      setLoadingQuestionIndex(null);
      setIsSearching(false);
    }
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

  // Render methods
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

  const renderSidebar = () => {
    return (
      <div 
        ref={sidebarRef}
        className={`fixed top-[75px] left-0 h-full w-80 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out z-20 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Add your sidebar content here */}
      </div>
    );
  };

  const renderSearchBar = () => {
    return (
      <form onSubmit={handleSearch} className="w-full">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Ask a question..."
          className="w-full p-2 border rounded-lg"
        />
      </form>
    );
  };

  const renderInitialQuestions = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {randomQuestions.map((question, index) => (
          <button
            key={index}
            onClick={(e) => handleSearch(e, index)}
            className="text-left p-4 border rounded-lg hover:bg-gray-50"
          >
            {question}
          </button>
        ))}
      </div>
    );
  };

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-75px)] bg-white pt-[75px]">
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
  );
};

export default Chat;
