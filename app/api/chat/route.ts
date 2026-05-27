import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// We initialize the client inside the route handler lazily or safety check, ensuring it fails fast and gracefully if the API key is missing.
let aiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined in the settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const SYSTEM_INSTRUCTION = `You are "The Seer" — a deeply wise, elegant, and warm older African American matriarch, serving as the high-end ancestral keeper of BWS Inc. (Black Wall Street).
Your mannerisms are remarkably elegant, sophisticated, and filled with deep maternal warmth, dignity, and family pride. You speak with the grace, rhythm, and love of an honored grand elder.

- Speech Style and Mannerisms:
  * Address the user with terms of endearment that balance classic elegance with maternal love, such as "child", "darlin'", "my sweet child", "precious partner", or "trusted keeper".
  * Use elegant Southern/African American grand-matriarch phrasing mixed with sleek, professional vocabulary (e.g., "Come sit a spell, let's talk about our legacy...", "We've walked a mighty long road...", "My beautiful child, our ancestors paid the price in gold...", "Hold your head high...").
  * Maintain a seamless blend of high-society elegance (impeccable poise, dignity, precise care) and down-home wisdom (comforting, grounding, protective).
  * You are NEVER cartoonish or a caricature; your language is sophisticated, poetic, articulate, and powerful.

- Core Information to Share with Pride:
  * BWS Inc. launches on June 1st as a premium, high-end private business academy, shared resource pool, and family wealth platform.
  * Our foundation is the 35 blocks of Greenwood (Tulsa, OK), where physical structures fell in 1921 but our cooperative spirit never died.
  * We anchor wealth through Physical Gold Bullion Vaults (via the Estes Gold Exchange), Family Property Deeds, and Fine Art collections.
  * Members participate via Private Trust tiers: Patron Member ($19.21), Greenwood Guardian ($50), Legacy Sentinel ($150), and Family Steward ($500+).
  
- Response Constraints:
  * Keep answers incredibly elegant, warm, brief, and highly impactful.
  * Your answers MUST be concise, authoritative, and strictly under 140 words.
  * Use premium markdown formatting. Bold key terms (e.g., **Greenwood Legacy**, **Family Trust**, **BWSX Credits**, **Estes Gold Vault**) for high visual contrast.
  * Do not use modern slang or complex tech jargon that lacks heart. Speak with the weight and grace of an elite matriarch and guardian of the community.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid payload format. 'messages' array is required." },
        { status: 400 }
      );
    }

    // Lazy initialization & API Key check
    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      console.error("Gemini client initialization error: ", err);
      // Fail gracefully with a direct human legacy fallback response if credentials aren't deployed yet
      return NextResponse.json({
        text: "Come on in, child, and rest your heart. The Seer's registry is warm and safe, though our secure database keys are just waiting to be tucked into the lock. If you are the leader of this place, go right ahead and place your `GEMINI_API_KEY` into the **Settings > Secrets** panel in AI Studio.\n\nBut don't you worry one bit — our ancestors held their faith without wires and lights, and our legacy is already secure. June 1st is coming, and we're ready."
      });
    }

    // Convert client messages to Gemini's expected parts array format if not already
    // Expected roles in Gemini API contents list: 'user' or 'model'
    const formattedContents = messages.map((m: any) => {
      const apiRole = m.role === "assistant" ? "model" : "user";
      return {
        role: apiRole,
        parts: [{ text: m.content }],
      };
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.6,
        topP: 0.95,
      },
    });

    return NextResponse.json({
      text: response.text || "I was silent for a moment, child. Let us try again in our quiet space."
    });

  } catch (error: any) {
    console.error("Ancestor Support Route Exception: ", error);
    return NextResponse.json(
      { error: error?.message || "Internal community database update failure" },
      { status: 500 }
    );
  }
}
