'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send,
  Bot,
  User,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Info,
  Cpu,
  Database,
  Zap,
  Route,
  Terminal,
  Wand2,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useFlightPlan, KNOWN_AREAS } from '@/context/FlightPlanContext';

interface Message {
  id: number;
  type: 'system' | 'user' | 'ai' | 'agent';
  content: string;
  timestamp: Date;
  icon?: 'alert' | 'check' | 'info' | 'route' | 'function';
  functionCall?: {
    name: string;
    args: any;
    result?: string;
  };
}

const initialMessages: Message[] = [
  { id: 1, type: 'system', content: 'LLM Agent initialized. Flight planning enabled.', timestamp: new Date(Date.now() - 300000), icon: 'check' },
  { id: 2, type: 'ai', content: 'Hello! I can help you plan UAV flight paths. Try: "Generate 10 waypoints for UAV-01 around Parking Area"', timestamp: new Date(Date.now() - 120000) },
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [useLocalMode, setUseLocalMode] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const { executeFunctionCall, parseUserIntent, flightPaths } = useFlightPlan();

  useEffect(() => {
    setMounted(true);
    // 检测API状态
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
      });
      if (response.ok) {
        setApiStatus('online');
        setUseLocalMode(false);
      } else {
        setApiStatus('offline');
        setUseLocalMode(true);
      }
    } catch {
      setApiStatus('offline');
      setUseLocalMode(true);
    }
  };

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const getIcon = (icon?: string) => {
    switch (icon) {
      case 'alert': return <AlertCircle className="w-3.5 h-3.5 text-orange-400" />;
      case 'check': return <CheckCircle className="w-3.5 h-3.5 text-green-400" />;
      case 'info': return <Info className="w-3.5 h-3.5 text-blue-400" />;
      case 'route': return <Route className="w-3.5 h-3.5 text-cyan-400" />;
      case 'function': return <Terminal className="w-3.5 h-3.5 text-purple-400" />;
      default: return <Bot className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  // 本地模式处理
  const handleLocalMode = async (userInput: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const intent = parseUserIntent(userInput);
    
    if (intent.functionName && intent.confidence > 0.5) {
      // 显示 Function Call
      const functionMsg: Message = {
        id: messages.length + 2,
        type: 'agent',
        content: `🔧 Local Parse: **${intent.functionName}**\n\`\`\`json\n${JSON.stringify(intent.args, null, 2)}\n\`\`\`\nConfidence: ${(intent.confidence * 100).toFixed(0)}%`,
        timestamp: new Date(),
        icon: 'function',
      };
      setMessages(prev => [...prev, functionMsg]);

      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = executeFunctionCall(intent.functionName, intent.args);
      
      const resultMsg: Message = {
        id: messages.length + 3,
        type: 'ai',
        content: result.message,
        timestamp: new Date(),
        icon: result.success ? 'route' : 'alert',
      };
      setMessages(prev => [...prev, resultMsg]);

      if (result.success && result.data && intent.functionName === 'generate_flight_path') {
        const infoMsg: Message = {
          id: messages.length + 4,
          type: 'system',
          content: `Flight path visible on map. ${result.data.waypoints.length} waypoints for ${result.data.name}.`,
          timestamp: new Date(),
          icon: 'info',
        };
        setMessages(prev => [...prev, infoMsg]);
      }
    } else {
      const aiMsg: Message = {
        id: messages.length + 2,
        type: 'ai',
        content: `To plan a flight, specify:\n• UAV ID (UAV-01, UAV-02, UAV-03)\n• Area: ${Object.values(KNOWN_AREAS).map(a => a.name).join(', ')}\n• Number of waypoints\n\nExample: "Generate 10 waypoints for UAV-01 around Parking Area"`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    }
  };

  // OpenAI API 处理
  const handleApiMode = async (userInput: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.filter(m => m.type === 'user' || m.type === 'ai').slice(-10).map(m => ({
              role: m.type === 'user' ? 'user' : 'assistant',
              content: m.content,
            })),
            { role: 'user', content: userInput },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.type === 'function_call') {
        const functionMsg: Message = {
          id: messages.length + 2,
          type: 'agent',
          content: `🔧 GPT Function Call: **${data.function_name}**\n\`\`\`json\n${JSON.stringify(data.arguments, null, 2)}\n\`\`\``,
          timestamp: new Date(),
          icon: 'function',
        };
        setMessages(prev => [...prev, functionMsg]);

        const result = executeFunctionCall(data.function_name, data.arguments);

        const resultMsg: Message = {
          id: messages.length + 3,
          type: 'ai',
          content: result.message,
          timestamp: new Date(),
          icon: result.success ? 'route' : 'alert',
        };
        setMessages(prev => [...prev, resultMsg]);

        if (result.success && result.data && data.function_name === 'generate_flight_path') {
          const infoMsg: Message = {
            id: messages.length + 4,
            type: 'system',
            content: `Flight path visible on map. ${result.data.waypoints.length} waypoints generated.`,
            timestamp: new Date(),
            icon: 'info',
          };
          setMessages(prev => [...prev, infoMsg]);
        }
      } else {
        const aiMsg: Message = {
          id: messages.length + 2,
          type: 'ai',
          content: data.content,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (error) {
      // API失败，切换到本地模式
      console.error('API failed, switching to local mode:', error);
      setUseLocalMode(true);
      setApiStatus('offline');
      
      const switchMsg: Message = {
        id: messages.length + 2,
        type: 'system',
        content: 'Switched to local NLU mode. Processing locally...',
        timestamp: new Date(),
        icon: 'info',
      };
      setMessages(prev => [...prev, switchMsg]);
      
      await handleLocalMode(userInput);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: Message = { 
      id: messages.length + 1, 
      type: 'user', 
      content: input, 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMsg]);
    const userInput = input;
    setInput('');
    setIsTyping(true);
    setIsProcessing(true);

    try {
      if (useLocalMode) {
        await handleLocalMode(userInput);
      } else {
        await handleApiMode(userInput);
      }
    } finally {
      setIsTyping(false);
      setIsProcessing(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickCommands = [
    { label: 'UAV-01 Parking', cmd: 'Generate 10 waypoints for UAV-01 around Parking Area' },
    { label: 'UAV-02 Plaza', cmd: 'Create 8 spiral waypoints for UAV-02 near Central Plaza' },
    { label: 'Clear UAV-01', cmd: 'Clear flight path for UAV-01' },
  ];

  if (!mounted) return null;

  return (
    <div className="card-glass h-full flex flex-col overflow-hidden relative group">
      {/* Tech Corner Decorations */}
      <div className="absolute top-0 left-0 w-2 h-2 border-l-2 border-t-2 border-cyan-500/50 rounded-tl-sm" />
      <div className="absolute top-0 right-0 w-2 h-2 border-r-2 border-t-2 border-cyan-500/50 rounded-tr-sm" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-l-2 border-b-2 border-cyan-500/50 rounded-bl-sm" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-cyan-500/50 rounded-br-sm" />

      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-[#0a0e1a] to-[#111827]">
        <div className="flex items-center gap-2">
          <motion.div
            className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 flex items-center justify-center"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          >
            <Wand2 className="w-4 h-4 text-purple-400" />
          </motion.div>
          <div>
            <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
              Flight Agent
              <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                useLocalMode 
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400' 
                  : 'bg-green-500/20 border border-green-500/40 text-green-400'
              }`}>
                {useLocalMode ? 'Local NLU' : 'GPT-4'}
              </span>
            </h3>
            <p className="text-[10px] text-slate-500">Function Calling</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {flightPaths.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
              <Route className="w-3 h-3 text-cyan-400" />
              <span className="text-[9px] text-cyan-400">{flightPaths.length}</span>
            </div>
          )}
          <button 
            onClick={() => { setUseLocalMode(!useLocalMode); }}
            className="p-1 hover:bg-slate-700/50 rounded transition-colors"
            title={useLocalMode ? 'Try GPT mode' : 'Switch to Local mode'}
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
          </button>
          <div className="flex items-center gap-1.5">
            <motion.span 
              className={`w-2 h-2 rounded-full ${useLocalMode ? 'bg-cyan-500' : 'bg-green-500'}`}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className={`text-[10px] ${useLocalMode ? 'text-cyan-400' : 'text-green-400'}`}>
              {useLocalMode ? 'Local' : 'Online'}
            </span>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1.5 border-b border-slate-700/30 flex items-center gap-4 text-[10px] bg-slate-900/30">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-cyan-500" />
          <span>{useLocalMode ? 'Local NLU' : 'gpt-4o-mini'}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Database className="w-3.5 h-3.5 text-blue-500" />
          <span>3 Functions</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Zap className="w-3.5 h-3.5 text-yellow-500" />
          <span>{useLocalMode ? '~50ms' : '~800ms'}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5 min-h-0 custom-scrollbar">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                msg.type === 'user' ? 'bg-blue-500/20 border border-blue-500/40' 
                : msg.type === 'ai' ? 'bg-cyan-500/20 border border-cyan-500/40'
                : msg.type === 'agent' ? 'bg-purple-500/20 border border-purple-500/40'
                : 'bg-slate-700/50 border border-slate-600/50'
              }`}>
                {msg.type === 'user' ? <User className="w-3.5 h-3.5 text-blue-400" /> 
                : msg.type === 'ai' ? <Bot className="w-3.5 h-3.5 text-cyan-400" /> 
                : msg.type === 'agent' ? <Terminal className="w-3.5 h-3.5 text-purple-400" />
                : getIcon(msg.icon)}
              </div>

              <div className={`flex-1 max-w-[85%] ${msg.type === 'user' ? 'text-right' : ''}`}>
                <div className={`inline-block px-3 py-2 rounded-lg text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.type === 'user' ? 'bg-blue-500/15 border border-blue-500/30 text-blue-100'
                  : msg.type === 'ai' ? 'bg-slate-800/60 border border-cyan-500/20 text-slate-200'
                  : msg.type === 'agent' ? 'bg-purple-500/10 border border-purple-500/30 text-purple-100 font-mono text-[11px]'
                  : 'bg-slate-800/40 border-l-2 border-l-slate-500 text-slate-300 rounded-l-none'
                }`}>
                  {msg.type === 'system' && <span className="text-slate-500 mr-1 text-[10px]">[SYS]</span>}
                  {msg.type === 'agent' && <span className="text-purple-400 mr-1 text-[10px]">[AGENT]</span>}
                  {msg.content}
                </div>
                <div className={`text-[10px] text-slate-600 mt-0.5 ${msg.type === 'user' ? 'text-right' : ''}`} suppressHydrationWarning>
                  {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <div className="flex gap-2">
            <div className={`w-6 h-6 rounded flex items-center justify-center ${isProcessing ? 'bg-purple-500/20 border border-purple-500/40' : 'bg-cyan-500/20 border border-cyan-500/40'}`}>
              <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg px-3 py-2">
              <div className="flex gap-1 items-center">
                <span className="text-xs text-purple-400 mr-1">
                  {useLocalMode ? 'Parsing locally...' : 'Calling GPT...'}
                </span>
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-purple-400"
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Commands */}
      <div className="px-3 py-2 border-t border-slate-700/30 flex gap-2 overflow-x-auto scrollbar-none">
        {quickCommands.map((cmd) => (
          <button
            key={cmd.label}
            className="px-2.5 py-1.5 bg-slate-800/50 hover:bg-purple-500/20 border border-slate-700/50 hover:border-purple-500/50 rounded text-[10px] text-slate-400 hover:text-purple-400 whitespace-nowrap transition-colors shrink-0"
            onClick={() => setInput(cmd.cmd)}
          >
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-slate-700/50 bg-gradient-to-r from-[#0a0e1a] to-[#111827]">
        <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-lg p-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKey}
            placeholder="Plan flights with natural language..."
            className="flex-1 bg-transparent border-none px-2 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none min-w-0"
            disabled={isTyping}
          />
          <div className="flex items-center gap-1 shrink-0 pr-1">
            <motion.button
              onClick={handleSend}
              className={`p-1.5 rounded transition-colors ${
                input.trim() && !isTyping 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-slate-700 text-slate-500'
              }`}
              whileHover={{ scale: input.trim() && !isTyping ? 1.1 : 1 }}
              whileTap={{ scale: input.trim() && !isTyping ? 0.9 : 1 }}
              disabled={!input.trim() || isTyping}
            >
              {isTyping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
