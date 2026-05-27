import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "Text prompt is required for TTS." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY is missing. Falling back to native system voice." },
        { status: 412 } // Precondition Failed status indicating fallback needed
      );
    }

    // Default voice: Bella (warm, clear female seer-like) or the configured one
    const selectVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
    
    // Call ElevenLabs API
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectVoiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        "accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.8
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API failure response:", errorText);

      let isPaymentFailure = response.status === 402 || errorText.includes("payment_required") || errorText.includes("payment_issue");
      let parsedDetail = errorText;

      try {
        const jsonError = JSON.parse(errorText);
        if (jsonError?.detail?.message) {
          parsedDetail = jsonError.detail.message;
          if (jsonError.detail.code === "payment_issue" || jsonError.detail.type === "payment_required") {
            isPaymentFailure = true;
          }
        }
      } catch (err) {
        // Fallback to plain text search if JSON parsing fails
      }

      return NextResponse.json(
        { 
          error: `ElevenLabs returned an error: ${response.statusText}`, 
          detail: parsedDetail,
          isPaymentFailure
        },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });

  } catch (error: any) {
    console.error("ElevenLabs TTS Bridge Exception: ", error);
    return NextResponse.json(
      { error: error?.message || "Internal voice proxy transmission error" },
      { status: 500 }
    );
  }
}
