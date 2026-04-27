import dotenv from 'dotenv';
dotenv.config();

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e4b';

export interface DailyMessageBlock {
    type: 'paragraph' | 'verse' | 'long_text' | 'youtube';
    text?: string;
    reference?: string;
    title?: string;
    pdfUrl?: string;
    url?: string;
    caption?: string;
}

/**
 * Generates a daily Bible-based devotional message for a group using Ollama.
 * Returns an array of content blocks in the app's DailyMessageContent format.
 */
export const generateDailyMessage = async (
    groupName: string,
    date: string,
    themeHint?: string
): Promise<DailyMessageBlock[]> => {
    const prompt = buildPrompt(groupName, date, themeHint);

    console.log(`[Ollama] Generating daily message for group "${groupName}" on ${date} using model ${OLLAMA_MODEL}...`);

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt,
            stream: false,
            options: {
                temperature: 0.8,
            }
        }),
        // @ts-ignore - signal not in older node types
        signal: AbortSignal.timeout(10 * 60 * 1000) // 10 min timeout
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown error');
        throw new Error(`Ollama API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as { response: string };
    const rawText = data.response?.trim() || '';

    console.log(`[Ollama] Raw response length: ${rawText.length} chars`);

    return parseOllamaResponse(rawText);
};

function buildPrompt(groupName: string, date: string, themeHint?: string): string {
    const dateObj = new Date(date + 'T12:00:00Z');
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    const friendlyDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

    const themeSection = themeHint ? `\nTheme focus: ${themeHint}` : '';

    return `You are a Christian devotional writer creating a daily Bible-based message for a Catholic young adults group called "${groupName}" for ${dayOfWeek}, ${friendlyDate}.${themeSection}

Create an inspiring, spiritually uplifting daily message. You MUST respond with ONLY valid JSON — no extra text before or after the JSON, no markdown code fences.

The JSON must be an array of content blocks. Use this exact structure:

[
  {
    "type": "verse",
    "text": "the Bible verse text here",
    "reference": "Book Chapter:Verse"
  },
  {
    "type": "paragraph",
    "text": "A short, inspiring reflection on the verse (2-4 sentences). Written warmly for young Catholic adults."
  },
  {
    "type": "long_text",
    "title": "A catchy devotional title (5-8 words)",
    "text": "A longer reflection (3-4 paragraphs) that expands on the theme. Include practical application for daily life. Use markdown for formatting (bold, line breaks between paragraphs)."
  }
]

Rules:
- Choose a real Bible verse (Catholic canon including deuterocanonical books is fine)
- The theme should be relevant and uplifting for young adults
- Keep the paragraph block concise and engaging
- The long_text should feel like a mini homily, not a lecture
- Return ONLY the JSON array, nothing else`;
}

function parseOllamaResponse(rawText: string): DailyMessageBlock[] {
    // Try to extract JSON array from the response
    // Sometimes the model wraps it in markdown code fences
    let jsonStr = rawText;

    // Strip markdown code fences if present
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
    }

    // Try to find a JSON array in the text
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        jsonStr = arrayMatch[0];
    }

    try {
        const parsed = JSON.parse(jsonStr);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            throw new Error('Response is not a non-empty array');
        }

        // Validate and sanitize blocks
        return parsed
            .filter((block: any) => block && typeof block === 'object' && block.type)
            .map((block: any): DailyMessageBlock => {
                const type = block.type as DailyMessageBlock['type'];
                switch (type) {
                    case 'verse':
                        return { type: 'verse', text: String(block.text || ''), reference: String(block.reference || '') };
                    case 'long_text':
                        return { type: 'long_text', title: String(block.title || 'Reflection'), text: String(block.text || '') };
                    case 'paragraph':
                    default:
                        return { type: 'paragraph', text: String(block.text || block.content || '') };
                }
            })
            .filter(block => block.text && block.text.trim().length > 0);
    } catch (err) {
        console.error('[Ollama] Failed to parse JSON response:', err);
        console.error('[Ollama] Raw text was:', rawText.substring(0, 500));

        // Fallback: return the raw text as a paragraph block
        return [{
            type: 'paragraph',
            text: `*AI Generation Note: The model returned an unexpected format. Raw content:*\n\n${rawText.substring(0, 1000)}`
        }];
    }
}

/**
 * Generates a game suggestion of a specific type using past examples for few-shot learning.
 */
export const generateGameSuggestion = async (
    gameType: string,
    examples: any[]
): Promise<any> => {
    let prompt = `You are an expert game designer creating a new game of type "${gameType}" for a Bible trivia app.\n`;
    prompt += `The game data must be returned as a valid JSON object.\n`;
    prompt += `Do NOT wrap the JSON in code blocks or add conversational text. Return ONLY the raw JSON object.\n\n`;

    if (examples && examples.length > 0) {
        prompt += `Here are some examples of past games of this type to show you the expected JSON structure and difficulty level:\n`;
        examples.forEach((ex, i) => {
            prompt += `\n--- Example ${i + 1} ---\n${JSON.stringify(ex, null, 2)}\n`;
        });
    }

    prompt += `\nGenerate a brand new, unique game of type "${gameType}" with completely different answers and clues from the examples. Ensure it is biblically accurate and strictly follows the exact same JSON schema as the examples.`;

    console.log(`[Ollama] Generating game suggestion for type "${gameType}" using model ${OLLAMA_MODEL}...`);

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt,
            stream: false,
            options: {
                temperature: 0.8,
            }
        }),
        // @ts-ignore
        signal: AbortSignal.timeout(10 * 60 * 1000)
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => 'unknown error');
        throw new Error(`Ollama API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as { response: string };
    const rawText = data.response?.trim() || '';

    let jsonStr = rawText;
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
    } else {
        const objMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objMatch) {
            jsonStr = objMatch[0];
        }
    }

    try {
        return JSON.parse(jsonStr);
    } catch (err) {
        console.error('[Ollama] Failed to parse JSON response for game:', err);
        console.error('[Ollama] Raw text was:', rawText.substring(0, 500));
        throw new Error('Failed to parse AI generated game data');
    }
};
