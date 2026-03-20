import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Terminal as TerminalIcon, 
  Server, 
  Code2, 
  Send, 
  Plus, 
  Cpu, 
  Activity, 
  ChevronRight,
  LayoutDashboard,
  Settings,
  Menu,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { generateAIResponse } from './services/ai';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface ServerStatus {
  status: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  platform: string;
  remote?: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'terminal' | 'server' | 'code'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: 'Привет! Я твой ИИ Серверный Ассистент. Я готов помочь тебе с кодом, управлением сервером или развертыванием приложений. Что мы сегодня создадим?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>(['[SYSTEM] Инициализация сервера...', '[SYSTEM] Подключение к ядру ИИ...', '[SYSTEM] Готов к работе.']);
  const [isBackendAvailable, setIsBackendAvailable] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, terminalLogs]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('Backend not responding');
        const data = await res.json();
        setServerStatus(data);
        setIsBackendAvailable(true);
      } catch (err) {
        console.error('Failed to fetch status', err);
        setIsBackendAvailable(false);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const terminalLogsRef = useRef<string[]>([]);

  useEffect(() => {
    terminalLogsRef.current = terminalLogs;
  }, [terminalLogs]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setTerminalLogs(prev => [...prev, `> ${input}`]);

    try {
      let currentHistory: any[] = newMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      let aiResponse = await generateAIResponse(currentHistory);
      
      // Handle tool calls in a loop
      let iterations = 0;
      const MAX_ITERATIONS = 10;

      while (aiResponse.functionCalls && iterations < MAX_ITERATIONS) {
        iterations++;
        const toolResults: any[] = [];
        
        for (const call of aiResponse.functionCalls) {
          setTerminalLogs(prev => [...prev, `[TOOL] Выполнение: ${call.name}...`]);
          
          let result;
          if (call.name === 'connect_to_server') {
            const res = await fetch('/api/ssh/connect', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                host: call.args.host, 
                username: call.args.username, 
                password: call.args.password,
                port: call.args.port || 22
              })
            });
            result = await res.json();
            setTerminalLogs(prev => [...prev, result.success ? `[SSH] Подключено к ${call.args.host}` : `[SSH] Ошибка: ${result.error}`]);
          } else if (call.name === 'execute_command') {
            const res = await fetch('/api/terminal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ command: call.args.command })
            });
            result = await res.json();
            setTerminalLogs(prev => [...prev, result.stdout || result.stderr || 'Команда выполнена.']);
          } else if (call.name === 'read_file') {
            const res = await fetch('/api/files/read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: call.args.filePath })
            });
            result = await res.json();
          } else if (call.name === 'write_file') {
            const res = await fetch('/api/files/write', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath: call.args.filePath, content: call.args.content })
            });
            result = await res.json();
            setTerminalLogs(prev => [...prev, `[FILE] Файл ${call.args.filePath} записан.`]);
          } else if (call.name === 'list_files') {
            const res = await fetch(`/api/files/list?path=${call.args.path || '.'}`);
            result = await res.json();
          } else if (call.name === 'get_terminal_logs') {
            result = { logs: terminalLogsRef.current.slice(-50) };
          }

          toolResults.push({
            name: call.name,
            response: { result },
            id: call.id
          });
        }

        // Send tool results back to AI
        currentHistory.push({
          role: 'model',
          parts: aiResponse.candidates[0].content.parts
        });
        currentHistory.push({
          role: 'user',
          parts: toolResults.map(r => ({
            functionResponse: r
          }))
        });

        aiResponse = await generateAIResponse(currentHistory);
      }

      const modelMsg: Message = {
        id: Date.now().toString(),
        role: 'model',
        text: aiResponse.text || 'Задача выполнена.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, modelMsg]);
      setTerminalLogs(prev => [...prev, `[AI] Задача завершена.`]);
    } catch (error: any) {
      console.error('AI Error:', error);
      let errorMessage = 'Произошла ошибка при выполнении команды на сервере.';
      
      if (error.message?.includes('Лимит запросов')) {
        errorMessage = 'Лимит запросов к ИИ исчерпан. Пожалуйста, подождите 1-2 минуты и попробуйте снова.';
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: errorMessage,
        timestamp: new Date()
      }]);
      setTerminalLogs(prev => [...prev, `[ERROR] ${errorMessage}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const inputEl = form.elements.namedItem('terminalInput') as HTMLInputElement;
    const cmd = inputEl.value;
    if (!cmd) return;

    setTerminalLogs(prev => [...prev, `> ${cmd}`]);
    inputEl.value = '';

    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      if (data.stdout) setTerminalLogs(prev => [...prev, data.stdout]);
      if (data.stderr) setTerminalLogs(prev => [...prev, `Error: ${data.stderr}`]);
    } catch (err) {
      setTerminalLogs(prev => [...prev, 'Ошибка подключения к терминалу.']);
    }
  };

  const NavItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setIsSidebarOpen(false);
      }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 w-full",
        activeTab === id 
          ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" 
          : "text-white/60 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen w-screen bg-bg overflow-hidden">
      {/* Sidebar for Desktop / Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="fixed inset-y-0 left-0 w-72 bg-card border-r border-white/5 z-50 p-6 flex flex-col gap-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent">
                <Cpu size={24} />
                <span className="font-bold text-xl tracking-tight">AI SERVER</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-white/40 hover:text-white">
                <X size={24} />
              </button>
            </div>

            <nav className="flex flex-col gap-2 flex-1">
              <NavItem id="chat" icon={MessageSquare} label="ИИ Чат" />
              <NavItem id="terminal" icon={TerminalIcon} label="Терминал" />
              <NavItem id="server" icon={Server} label="Сервер" />
              <NavItem id="code" icon={Code2} label="Редактор" />
            </nav>

            <div className="pt-6 border-t border-white/5">
              <button className="flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white w-full">
                <Settings size={20} />
                <span>Настройки</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 glass sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-white/60 hover:text-white lg:hidden"
            >
              <Menu size={24} />
            </button>
            <h1 className="font-semibold text-lg capitalize">
              {activeTab === 'chat' && 'Ассистент'}
              {activeTab === 'terminal' && 'Терминал'}
              {activeTab === 'server' && 'Статус Сервера'}
              {activeTab === 'code' && 'Код'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {!isBackendAvailable && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20">
                <AlertCircle size={14} />
                Static Mode (No Backend)
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </div>
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent font-bold text-xs">
              AI
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full flex flex-col"
              >
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
                >
                  {messages.map((msg) => (
                    <div 
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[85%] sm:max-w-[75%]",
                        msg.role === 'user' ? "ml-auto items-end" : "items-start"
                      )}
                    >
                      <div className={cn(
                        "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-accent text-white rounded-tr-none" 
                          : "bg-card border border-white/5 text-white/90 rounded-tl-none shadow-xl"
                      )}>
                        <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:p-3 prose-pre:rounded-lg">
                          <Markdown>
                            {msg.text}
                          </Markdown>
                        </div>
                      </div>
                      <span className="text-[10px] text-white/30 mt-1 px-1">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 text-white/40 text-xs">
                      <Loader2 size={14} className="animate-spin" />
                      ИИ думает...
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-4 sm:p-6 border-t border-white/5 bg-bg/80 backdrop-blur-xl">
                  <div className="max-w-4xl mx-auto flex items-end gap-2 bg-card border border-white/10 rounded-2xl p-2 focus-within:border-accent/50 transition-colors">
                    <button className="p-2 text-white/40 hover:text-white transition-colors">
                      <Plus size={20} />
                    </button>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Спроси что-нибудь или дай команду..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-1 resize-none max-h-32 min-h-[40px]"
                      rows={1}
                    />
                    <button 
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="p-2 bg-accent text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'terminal' && (
              <motion.div 
                key="terminal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full bg-black p-4 font-mono text-xs sm:text-sm flex flex-col"
              >
                <div className="flex-1 overflow-y-auto mb-4" ref={scrollRef}>
                  <div className="flex flex-col gap-1">
                    {terminalLogs.map((log, i) => (
                      <div key={i} className={cn(
                        "break-all whitespace-pre-wrap",
                        log.startsWith('>') ? "text-accent" : 
                        log.startsWith('[SYSTEM]') ? "text-emerald-500" : 
                        log.startsWith('[AI]') ? "text-violet-400" : 
                        log.startsWith('[TOOL]') ? "text-amber-400" : "text-white/80"
                      )}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
                <form onSubmit={handleTerminalSubmit} className="flex items-center gap-2 text-accent border-t border-white/10 pt-4">
                  <span>$</span>
                  <input 
                    name="terminalInput"
                    autoFocus
                    autoComplete="off"
                    className="flex-1 bg-transparent border-none focus:ring-0 p-0 text-accent font-mono"
                    placeholder="Введите команду..."
                  />
                </form>
              </motion.div>
            )}

            {activeTab === 'server' && (
              <motion.div 
                key="server"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="h-full p-6 overflow-y-auto"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
                  {/* Status Card */}
                  <div className="bg-card border border-white/5 p-6 rounded-3xl flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                        <Activity size={24} />
                      </div>
                      <span className="text-xs font-mono text-white/40">ID: srv-01</span>
                    </div>
                    <div>
                      <h3 className="text-white/60 text-sm mb-1">Состояние системы</h3>
                      <p className="text-2xl font-bold flex items-center gap-2">
                        {serverStatus?.remote ? 'Удаленный' : 'Локальный'}
                        <span className={cn("w-2 h-2 rounded-full", serverStatus?.remote ? "bg-blue-500" : "bg-emerald-500")} />
                      </p>
                    </div>
                    {serverStatus?.remote && (
                      <button 
                        onClick={async () => {
                          await fetch('/api/ssh/disconnect', { method: 'POST' });
                          setTerminalLogs(prev => [...prev, '[SSH] Отключено.']);
                        }}
                        className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Отключиться от SSH
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Uptime</p>
                        <p className="text-sm font-mono">
                          {serverStatus ? Math.floor(serverStatus.uptime / 60) : 0}m {serverStatus ? Math.floor(serverStatus.uptime % 60) : 0}s
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Platform</p>
                        <p className="text-sm font-mono">{serverStatus?.platform || 'linux'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Memory Card */}
                  <div className="bg-card border border-white/5 p-6 rounded-3xl flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-violet-500/10 rounded-2xl text-violet-500">
                        <Cpu size={24} />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-white/60 text-sm mb-1">Использование памяти</h3>
                      <p className="text-2xl font-bold">
                        {serverStatus ? (serverStatus.memory.heapUsed / 1024 / 1024).toFixed(1) : 0} MB
                      </p>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mt-2">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: serverStatus ? `${(serverStatus.memory.heapUsed / serverStatus.memory.heapTotal) * 100}%` : '0%' }}
                        className="h-full bg-violet-500"
                      />
                    </div>
                    <p className="text-[10px] text-white/30 text-right">
                      Total: {serverStatus ? (serverStatus.memory.heapTotal / 1024 / 1024).toFixed(1) : 0} MB
                    </p>
                  </div>

                  {/* Deployments */}
                  <div className="bg-card border border-white/5 p-6 rounded-3xl sm:col-span-2">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <LayoutDashboard size={18} className="text-accent" />
                      Активные проекты
                    </h3>
                    <div className="space-y-3">
                      {[
                        { name: 'my-react-app', status: 'live', url: 'app-123.run.app' },
                        { name: 'backend-api', status: 'live', url: 'api-456.run.app' },
                        { name: 'landing-page', status: 'stopped', url: 'page-789.run.app' }
                      ].map((project, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              project.status === 'live' ? "bg-emerald-500/10 text-emerald-500" : "bg-white/5 text-white/20"
                            )}>
                              <Server size={20} />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{project.name}</p>
                              <p className="text-xs text-white/40">{project.url}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={cn(
                              "text-[10px] uppercase font-bold px-2 py-1 rounded-md",
                              project.status === 'live' ? "bg-emerald-500/10 text-emerald-500" : "bg-white/10 text-white/40"
                            )}>
                              {project.status}
                            </span>
                            <ChevronRight size={16} className="text-white/20 group-hover:text-white/60 transition-colors" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'code' && (
              <motion.div 
                key="code"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col p-6"
              >
                <div className="flex-1 bg-black/50 rounded-3xl border border-white/5 overflow-hidden flex flex-col">
                  <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/50" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/50" />
                      <span className="ml-4 text-xs font-mono text-white/40">server.ts</span>
                    </div>
                    <button className="text-xs text-accent hover:underline">Копировать</button>
                  </div>
                  <pre className="flex-1 p-6 font-mono text-sm overflow-auto text-white/80">
                    <code>{`import express from "express";
const app = express();

app.get("/", (req, res) => {
  res.send("Hello from AI Server!");
});

app.listen(3000, () => {
  console.log("Server is running...");
});`}</code>
                  </pre>
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="flex-1 bg-accent text-white py-3 rounded-2xl font-medium shadow-lg shadow-accent/20 flex items-center justify-center gap-2">
                    <CheckCircle2 size={18} />
                    Развернуть
                  </button>
                  <button className="px-6 bg-white/5 text-white py-3 rounded-2xl font-medium border border-white/5 hover:bg-white/10 transition-colors">
                    Отмена
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden h-16 border-t border-white/5 bg-card/80 backdrop-blur-xl flex items-center justify-around px-4">
          <button 
            onClick={() => setActiveTab('chat')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'chat' ? "text-accent" : "text-white/40")}
          >
            <MessageSquare size={20} />
            <span className="text-[10px] font-medium">Чат</span>
          </button>
          <button 
            onClick={() => setActiveTab('terminal')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'terminal' ? "text-accent" : "text-white/40")}
          >
            <TerminalIcon size={20} />
            <span className="text-[10px] font-medium">Терминал</span>
          </button>
          <button 
            onClick={() => setActiveTab('server')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'server' ? "text-accent" : "text-white/40")}
          >
            <Server size={20} />
            <span className="text-[10px] font-medium">Сервер</span>
          </button>
          <button 
            onClick={() => setActiveTab('code')}
            className={cn("flex flex-col items-center gap-1", activeTab === 'code' ? "text-accent" : "text-white/40")}
          >
            <Code2 size={20} />
            <span className="text-[10px] font-medium">Код</span>
          </button>
        </nav>
      </main>
    </div>
  );
}
