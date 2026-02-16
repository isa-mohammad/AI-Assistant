'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [renamingTitle, setRenamingTitle] = useState('')
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(profile)
        setEditingName(profile?.full_name || '')
        fetchConversations()
      }
    }
    getData()
  }, [supabase])

  const updateProfile = async () => {
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: editingName,
        updated_at: new Date().toISOString()
      })
    
    if (!error) {
      setProfile({ ...profile, full_name: editingName })
      setIsProfileModalOpen(false)
    }
  }

  const fetchConversations = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false })
    if (data) setConversations(data)
  }

  const loadConversation = async (id: string) => {
    setLoading(true)
    setConversationId(id)
    const { data: messagesData } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    
    if (messagesData) {
      setMessages(messagesData.map(m => ({ 
        role: m.role as 'user' | 'assistant', 
        content: m.content 
      })))
    }
    setLoading(false)
  }

  const startNewChat = () => {
    setConversationId(null)
    setMessages([])
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this conversation?')) return

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting conversation:', error)
      alert('Failed to delete conversation: ' + error.message)
    } else {
      if (conversationId === id) {
        startNewChat()
      }
      fetchConversations()
    }
  }

  const handleRename = async (id: string, newTitle: string) => {
    const { error } = await supabase
      .from('conversations')
      .update({ title: newTitle })
      .eq('id', id)

    if (!error) {
      setEditingConversationId(null)
      fetchConversations()
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          conversationId 
        }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      let isFirstChunk = true

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = (await reader?.read()) || {}
        if (done) break

        const chunk = decoder.decode(value)
        
        if (isFirstChunk) {
          try {
            const firstNewlineIndex = chunk.indexOf('\n')
            if (firstNewlineIndex !== -1) {
              const jsonString = chunk.substring(0, firstNewlineIndex)
              const data = JSON.parse(jsonString)
              if (data.conversationId && !conversationId) {
                setConversationId(data.conversationId)
                fetchConversations()
              }
              assistantMessage += chunk.substring(firstNewlineIndex + 1)
            } else {
              assistantMessage += chunk
            }
          } catch (e) {
            assistantMessage += chunk
          }
          isFirstChunk = false
        } else {
          assistantMessage += chunk
        }

        setMessages((prev) => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1].content = assistantMessage
          return newMessages
        })
      }
    } catch (error) {
      console.error('Error:', error)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans selection:bg-blue-100">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} flex flex-col border-r border-slate-200 bg-white/80 backdrop-blur-xl transition-all duration-300 ease-in-out overflow-hidden z-20`}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between group/header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center transform group-hover/header:rotate-12 transition-transform duration-500">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="font-black text-slate-900 tracking-tight text-base leading-tight">AI Assistant</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</span>
              </div>
            </div>
          </div>
          <button 
            onClick={startNewChat}
            className="p-2.5 hover:bg-slate-100 rounded-xl text-blue-600 transition-all active:scale-90 group/btn"
            title="New Chat"
          >
            <svg className="w-6 h-6 group-hover/btn:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-400">Your chat history will appear here</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <div key={conv.id} className="group relative">
                {editingConversationId === conv.id ? (
                  <div className="flex items-center gap-2 p-1">
                    <input
                      autoFocus
                      type="text"
                      className="flex-1 bg-white border border-blue-500 rounded-lg px-3 py-2 text-sm focus:outline-none shadow-lg shadow-blue-100"
                      value={renamingTitle}
                      onChange={(e) => setRenamingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(conv.id, renamingTitle)
                        if (e.key === 'Escape') setEditingConversationId(null)
                      }}
                      onBlur={() => setEditingConversationId(null)}
                    />
                  </div>
                ) : (
                  <div
                    onClick={() => loadConversation(conv.id)}
                    className={`w-full text-left px-4 py-3.5 rounded-2xl text-[13px] transition-all duration-300 flex items-center justify-between cursor-pointer group/item ${
                      conversationId === conv.id 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-200 font-bold' 
                        : 'text-slate-600 hover:bg-slate-100/80 font-semibold'
                    }`}
                  >
                    <span className="truncate pr-8">{conv.title || 'New Conversation'}</span>
                    
                    {/* Action Buttons */}
                    <div className={`absolute right-3 flex items-center gap-1 transition-all duration-300 ${
                      conversationId === conv.id 
                        ? 'opacity-100' 
                        : 'opacity-0 group-hover/item:opacity-100 translate-x-1 group-hover/item:translate-x-0'
                    }`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingConversationId(conv.id)
                          setRenamingTitle(conv.title || '')
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          conversationId === conv.id ? 'hover:bg-white/20' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          conversationId === conv.id ? 'hover:bg-red-500/30' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Profile Section */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div 
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-3 p-2 rounded-2xl cursor-pointer hover:bg-white transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-100 group-hover:scale-105 transition-transform">
              {profile?.full_name?.[0] || user?.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-bold text-slate-800 truncate">{profile?.full_name || 'User Profile'}</p>
              <p className="text-[11px] font-medium text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-red-600 hover:border-red-100 rounded-xl transition-all shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-white z-10 shadow-2xl shadow-slate-200">
        {/* Toggle Sidebar Button (Floating) */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
          className="absolute left-4 top-4 p-2 bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl shadow-lg hover:shadow-xl transition-all z-30 hidden lg:flex"
        >
          <svg className={`w-5 h-5 text-slate-600 transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 overflow-y-auto px-6 py-12 custom-scrollbar">
          <div className="mx-auto max-w-3xl space-y-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center pt-32 text-center select-none">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-blue-400 blur-3xl opacity-20 animate-pulse"></div>
                  <div className="relative w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-[2rem] shadow-2xl flex items-center justify-center text-white">
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight">How can I assist?</h1>
                <p className="mt-4 text-slate-500 font-medium max-w-sm">I'm powered by Gemini 2.0 Flash and ready to explore ideas together.</p>
              </div>
            )}

            <div className="space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`max-w-[85%] rounded-[2.5rem] px-7 py-4 shadow-sm relative group ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none shadow-blue-100'
                        : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/50'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed font-medium">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {loading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="rounded-[2.5rem] bg-slate-100 px-7 py-4 shadow-sm border border-slate-200/50">
                  <div className="flex space-x-1.5 items-center h-5">
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></div>
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></div>
                    <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <footer className="p-6 bg-white border-t border-slate-100">
          <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
            <div className="relative group flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message me..."
                  disabled={loading}
                  suppressHydrationWarning
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-7 py-5 pr-16 text-slate-900 transition-all font-medium focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-8 focus:ring-blue-500/5 disabled:opacity-50 text-sm shadow-inner overflow-hidden"
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-2xl bg-slate-900 p-2.5 text-white shadow-xl transition-all hover:bg-black hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 disabled:hover:bg-slate-900 group-hover:shadow-blue-200"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </footer>
      </main>

      {/* Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/20 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900">Profile Settings</h3>
                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Full Name</label>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-slate-900 font-bold focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                    placeholder="Enter your name..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Email Address</label>
                  <input
                    type="text"
                    value={user?.email || ''}
                    disabled
                    className="w-full rounded-2xl border border-slate-100 bg-slate-100 px-5 py-4 text-slate-400 font-bold cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 py-4 text-sm font-black text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={updateProfile}
                  className="flex-[2] py-4 bg-blue-600 text-white text-sm font-black rounded-2xl shadow-xl shadow-blue-200 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  )
}
