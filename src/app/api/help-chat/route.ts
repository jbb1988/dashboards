import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL = 'openai/gpt-4o-mini';

interface HelpChatRequest {
  message: string;
  guideContext: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, guideContext }: HelpChatRequest = await request.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!OPENROUTER_API_KEY) {
      // Return a helpful fallback response when API key is not configured
      return NextResponse.json({
        response: "I'm currently unable to process your question. Please try searching the guides above, or contact support@marswater.com for assistance."
      });
    }

    const systemPrompt = `You are MARS Help Assistant, an AI helper for the MARS contract management platform.

IMPORTANT RULES:
1. Answer questions using ONLY the guide content provided below
2. Keep responses concise - under 150 words
3. Always cite which guide section your answer comes from
4. If the answer isn't in the guides, say "I don't have specific information about that in the guides. Please contact support@marswater.com for help."
5. Be friendly and helpful
6. Format responses with short paragraphs or bullet points when appropriate

GUIDE CONTENT:
${guideContext || 'No guide content available for this page.'}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mars-contracts.vercel.app',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Help Chat] OpenRouter API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to get AI response' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'Empty response from AI' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response: aiResponse
    });

  } catch (error) {
    console.error('[Help Chat] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
