
Claude · MD
Copy

# Building a Next.js 15 App with Supabase, Google Auth & Anthropic API

## 📋 Project Overview

In this tutorial, we'll build a full-stack AI-powered application using:
- **Next.js 15** with App Router
- **Supabase** for authentication and database
- **Google OAuth** for user authentication
- **Anthropic API** (Claude) for AI features

## 🎯 What We'll Build

A modern web application where authenticated users can interact with Claude AI. Perfect for building chatbots, content generators, or AI assistants.

---

## 📚 Prerequisites

- Node.js 18+ installed
- A Google Cloud account (for OAuth)
- A Supabase account (free tier works)
- An Anthropic API key
- Basic knowledge of React and TypeScript

---

## 🚀 Part 1: Project Setup

### Step 1: Create Next.js 15 Project

```bash
npx create-next-app@latest my-ai-app
```

**Configuration options:**
- ✅ TypeScript
- ✅ ESLint
- ✅ Tailwind CSS
- ✅ App Router
- ✅ Turbopack
- ❌ Customize import alias (use default)

```bash
cd my-ai-app
```

### Step 2: Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr @anthropic-ai/sdk
npm install -D @types/node
```

---

## 🔐 Part 2: Supabase Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details
4. Wait for database provisioning (~2 minutes)

### Step 2: Configure Google OAuth in Supabase

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Google** provider
3. Note the **Authorized Client IDs** section

### Step 3: Set Up Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add **Authorized redirect URIs**:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```
7. Copy **Client ID** and **Client Secret**

### Step 4: Add Google Credentials to Supabase

1. Back in Supabase → **Authentication** → **Providers** → **Google**
2. Paste **Client ID** and **Client Secret**
3. Click **Save**

### Step 5: Get Supabase Credentials

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL**
   - **anon/public** key

---

## 🔑 Part 3: Environment Variables

Create `.env.local` in project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-api03-your-api-key
```

⚠️ **Important**: Add `.env.local` to `.gitignore` (should already be there)

---

## 🛠️ Part 4: Supabase Client Setup

### Create Supabase Utilities

**File: `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**File: `lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  )
}
```

**File: `lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect routes
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

---

## 🔄 Part 5: Middleware Configuration

**File: `middleware.ts`** (root level)

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

---

## 🎨 Part 6: Authentication UI

### Login Page

**File: `app/login/page.tsx`**

```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (error) {
      console.error('Error logging in:', error.message)
    }
  }

  return (
    
      
        
          
            Welcome Back
          
          
            Sign in to access your AI assistant
          
        

        
          
            
            
            
            
          
          Continue with Google
        
      
    
  )
}
```

### Auth Callback Handler

**File: `app/auth/callback/route.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
```

---

## 🤖 Part 7: Anthropic API Integration

### Server Action for Claude API

**File: `app/actions/chat.ts`**

```typescript
'use server'

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function sendMessage(message: string) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
    })

    const textContent = response.content.find(
      (content) => content.type === 'text'
    )

    return {
      success: true,
      message: textContent?.type === 'text' ? textContent.text : '',
    }
  } catch (error) {
    console.error('Anthropic API Error:', error)
    return {
      success: false,
      message: 'Failed to get response from Claude',
    }
  }
}
```

### Streaming Response (Advanced)

**File: `app/api/chat/route.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Verify authentication
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { message } = await request.json()

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: message }],
  })

  // Transform Anthropic stream to Response stream
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
```

---

## 🎨 Part 8: Chat Interface

**File: `app/page.tsx`**

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function HomePage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(null)
  const messagesEndRef = useRef(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [])

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
        body: JSON.stringify({ message: userMessage }),
      })

      if (!response.ok) throw new Error('Failed to get response')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = (await reader?.read()) || {}
        if (done) break

        const chunk = decoder.decode(value)
        assistantMessage += chunk

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
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    
      {/* Header */}
      
        
          AI Assistant
          
            {user && (
              <>
                
                  {user.email}
                
                
                  Sign Out
                
              </>
            )}
          
        
      

      {/* Messages */}
      
        
          {messages.length === 0 && (
            
              Start a conversation with Claude
            
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-800 shadow-md'
                }`}
              >
                {message.content}
              
            
          ))}

          {loading && messages[messages.length - 1]?.role === 'user' && (
            
              
                
                  
                  
                  
                
              
            
          )}

          
        
      

      {/* Input */}
      
        
          
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
            />
            
              Send
            
          
        
      
    
  )
}
```

---

## 🗄️ Part 9: Database Schema (Optional)

If you want to store chat history:

### Create Table in Supabase

Go to **SQL Editor** in Supabase and run:

```sql
-- Create conversations table
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies for conversations
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies for messages
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );
```

---

## 🚀 Part 10: Running the Application

### Development Mode

```bash
npm run dev
```

Visit `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

---

## 📦 Part 11: Deployment (Vercel)

### Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or push to GitHub and connect via Vercel dashboard.

### Environment Variables in Vercel

Add in **Project Settings** → **Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`

### Update Redirect URLs

After deployment, add your production URL to:
1. **Google Cloud Console** → OAuth redirect URIs
2. **Supabase** → Authentication → URL Configuration → Redirect URLs

---

## 🎯 Key Features Implemented

✅ Google OAuth authentication via Supabase  
✅ Protected routes with middleware  
✅ Server-side authentication checks  
✅ Streaming responses from Claude API  
✅ Real-time chat interface  
✅ Session management  
✅ Responsive design with Tailwind CSS  

---

## 🔒 Security Best Practices

1. **Never expose API keys** - Keep `ANTHROPIC_API_KEY` server-side only
2. **Use environment variables** - Never hardcode sensitive data
3. **Implement rate limiting** - Protect against API abuse
4. **Validate user input** - Sanitize before sending to API
5. **Use Row Level Security** - Enable RLS on all Supabase tables
6. **HTTPS only** - Ensure production uses HTTPS

---

## 🐛 Common Issues & Solutions

### Issue: "Invalid redirect URL"
**Solution**: Ensure redirect URL in Google Console matches exactly with Supabase callback URL

### Issue: "ANTHROPIC_API_KEY is undefined"
**Solution**: Restart dev server after adding environment variables

### Issue: Authentication loop
**Solution**: Clear cookies and ensure middleware paths are correct

### Issue: CORS errors
**Solution**: Use server-side API routes, not client-side direct API calls

---

## 📚 Additional Resources

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Anthropic API Reference](https://docs.anthropic.com)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## 🎓 Next Steps

1. **Add conversation history** - Implement database storage
2. **Add file uploads** - Support PDFs and images with Claude
3. **Implement streaming UI** - Better UX for long responses
4. **Add rate limiting** - Prevent API abuse
5. **Deploy to production** - Go live with Vercel
6. **Add analytics** - Track usage and performance

---

## 💡 Tips for YouTube Tutorial

1. **Show live coding** - Type everything, don't paste
2. **Explain each step** - Don't assume knowledge
3. **Test as you go** - Run the app after each major section
4. **Handle errors** - Show common mistakes and fixes
5. **Provide timestamps** - Help viewers navigate
6. **Link to repo** - Share completed code on GitHub

---

## 📝 Project Structure

```
my-ai-app/
├── app/
│   ├── actions/
│   │   └── chat.ts
│   ├── api/
│   │   └── chat/
│   │       └── route.ts
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts
│   ├── login/
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── middleware.ts
├── middleware.ts
├── .env.local
├── next.config.js
├── package.json
└── tsconfig.json
```

---

## ✨ Conclusion

You now have a fully functional Next.js 15 application with:
- Secure Google authentication via Supabase
- Real-time AI chat powered by Claude
- Modern UI with streaming responses
- Production-ready architecture

**Happy coding!** 🚀