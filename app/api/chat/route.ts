import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: Request) {
    const { message, conversationId: existingConversationId } = await request.json()
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return new Response('Unauthorized', { status: 401 })
    }

    try {
        let conversationId = existingConversationId

        // 1. Create a new conversation if one doesn't exist
        if (!conversationId) {
            const { data: conversation, error: convError } = await supabase
                .from('conversations')
                .insert({
                    user_id: user.id,
                    title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                })
                .select()
                .single()

            if (convError) throw convError
            conversationId = conversation.id
        }

        // 2. Save the user's message
        const { error: userMsgError } = await supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                role: 'user',
                content: message,
            })

        if (userMsgError) throw userMsgError

        // 3. Generate AI response stream
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
        const result = await model.generateContentStream(message)

        let fullAssistantMessage = ''

        const readable = new ReadableStream({
            async start(controller) {
                try {
                    // Send conversationId as the first chunk so the client can track it
                    const initialPayload = JSON.stringify({ conversationId }) + '\n'
                    controller.enqueue(new TextEncoder().encode(initialPayload))

                    for await (const chunk of result.stream) {
                        const text = chunk.text()
                        fullAssistantMessage += text
                        controller.enqueue(new TextEncoder().encode(text))
                    }

                    // 4. Save the assistant's message after the stream ends
                    const { error: assistantMsgError } = await supabase
                        .from('messages')
                        .insert({
                            conversation_id: conversationId,
                            role: 'assistant',
                            content: fullAssistantMessage,
                        })

                    if (assistantMsgError) console.error('Error saving assistant message:', assistantMsgError)

                    controller.close()
                } catch (error) {
                    console.error('Stream processing error:', error)
                    controller.error(error)
                }
            },
        })

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        })
    } catch (error: any) {
        console.error('Gemini API Error:', error)
        return new Response(JSON.stringify({ error: error.message || 'Gemini API Error' }), {
            status: error.status || 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
