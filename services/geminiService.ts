import { GoogleGenAI, Type } from "@google/genai";
import { MASTER_SERMON_PROCESSING_PROMPT } from '../constants';
import { SermonSummaryOutput } from '../types';

// We proxy through the current domain to avoid exposing the real API key
const ai = new GoogleGenAI({ 
  apiKey: 'proxy',
  httpOptions: {
    baseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
  }
});

const GEMINI_MODEL = 'gemini-2.0-flash'; // Upgraded to 2.0-flash for better JSON & speed

// ── JSON Schema for Sermon Processing ──────────────────────────────────────────

const SERMON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    main_topic: { type: Type.STRING },
    clean_transcript: { type: Type.STRING },
    scriptures: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          reference: { type: Type.STRING },
          plain_meaning: { type: Type.STRING },
          speaker_usage: { type: Type.STRING },
        },
        required: ["reference"]
      }
    },
    key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
    quotes: { type: Type.ARRAY, items: { type: Type.STRING } },
    applications: { type: Type.ARRAY, items: { type: Type.STRING } },
    open_questions: { type: Type.ARRAY, items: { type: Type.STRING } },
    actionable_insights: { type: Type.ARRAY, items: { type: Type.STRING } },
    reflection: {
      type: Type.OBJECT,
      properties: {
        takeaway: { type: Type.STRING },
        reflection_text: { type: Type.STRING },
        prayer: { type: Type.STRING },
      }
    },
    quiz: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.NUMBER },
          explanation: { type: Type.STRING },
        },
        required: ["question", "options", "correctIndex"]
      }
    },
    flashcards: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          front: { type: Type.STRING },
          back: { type: Type.STRING },
        },
        required: ["front", "back"]
      }
    },
    mind_map: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        label: { type: Type.STRING },
        type: { type: Type.STRING },
        children: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              type: { type: Type.STRING },
              children: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    type: { type: Type.STRING }
                  },
                  required: ["id", "label", "type"]
                }
              }
            },
            required: ["id", "label", "type"]
          }
        }
      },
      required: ["id", "label", "type"]
    }
  },
  required: [
    "title", 
    "main_topic", 
    "clean_transcript", 
    "scriptures", 
    "key_points", 
    "quotes", 
    "applications", 
    "open_questions", 
    "actionable_insights", 
    "quiz", 
    "flashcards", 
    "mind_map"
  ]
};

// ── Service Functions ─────────────────────────────────────────────────────────

export async function processSermonTranscript(
  transcript: string,
  includeReflection: boolean,
): Promise<SermonSummaryOutput> {
  return callGemini([{ text: MASTER_SERMON_PROCESSING_PROMPT(transcript, includeReflection) }], includeReflection);
}

export async function processSermonFile(
  file: File,
  includeReflection: boolean,
  onProgress?: (status: string) => void,
): Promise<SermonSummaryOutput> {
  let fileToSend: File | Blob = file;
  let mimeType = file.type;

  // Extract/downsample audio to 16kHz mono WAV if video or large (> 8MB)
  if (file.type.startsWith('video/') || file.size > 8 * 1024 * 1024) {
    try {
      if (onProgress) onProgress("Extracting & optimizing audio track...");
      const wavBlob = await extractAudioToWav(file);
      fileToSend = wavBlob;
      mimeType = 'audio/wav';
    } catch (err) {
      console.warn("Failed to extract audio track, falling back to original file:", err);
    }
  }

  if (onProgress) onProgress("Uploading and analyzing sermon with AI...");
  const base64Data = await fileToBase64(fileToSend);
  const prompt = MASTER_SERMON_PROCESSING_PROMPT("Attached media file", includeReflection);
  
  return callGemini([
    { text: prompt },
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    }
  ], includeReflection);
}

// ── Web Audio Downsampling & WAV Encoding Helpers ─────────────────────────────

async function extractAudioToWav(file: File): Promise<Blob> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("Web Audio API is not supported in this browser.");
  }
  const audioCtx = new AudioContextClass();
  const arrayBuffer = await file.arrayBuffer();
  
  // Decode audio data
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
  // Downsample to 16000Hz mono
  const targetSampleRate = 16000;
  const numberOfChannels = 1;
  const duration = audioBuffer.duration;
  
  const offlineCtx = new OfflineAudioContext(
    numberOfChannels,
    targetSampleRate * duration,
    targetSampleRate
  );
  
  // Create a buffer source
  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start();
  
  // Render audio
  const renderedBuffer = await offlineCtx.startRendering();
  
  // Close the original context to free up hardware resources
  try {
    await audioCtx.close();
  } catch (e) {
    // Ignore context close errors
  }
  
  // Encode as WAV
  return audioBufferToWav(renderedBuffer);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // raw PCM
  const bitDepth = 16;
  
  let result;
  if (numOfChan === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
  } else {
    result = buffer.getChannelData(0);
  }
  
  const bufferLength = result.length * 2;
  const bufferArray = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(bufferArray);
  
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + bufferLength, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numOfChan, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * numOfChan * (bitDepth / 8), true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, numOfChan * (bitDepth / 8), true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, bufferLength, true);
  
  // Write PCM audio samples
  floatTo16BitPCM(view, 44, result);
  
  return new Blob([view], { type: 'audio/wav' });
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  
  while (index < length) {
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}


async function callGemini(parts: any[], includeReflection: boolean): Promise<SermonSummaryOutput> {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: SERMON_SCHEMA,
      },
    });

    const jsonString = response.text;

    if (!jsonString) {
      throw new Error("No response or empty response from Gemini API.");
    }

    const parsedData: SermonSummaryOutput = JSON.parse(jsonString);

    // Initialize optional fields if missing
    parsedData.actionable_insights = parsedData.actionable_insights || [];
    parsedData.user_notes = parsedData.user_notes || [];
    parsedData.personal_action_items = parsedData.personal_action_items || [];
    parsedData.quiz = parsedData.quiz || [];
    parsedData.flashcards = parsedData.flashcards || [];
    parsedData.mind_map = parsedData.mind_map || undefined;

    if (!includeReflection) {
      parsedData.reflection = {};
    }

    return parsedData;
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    throw new Error(`AI Processing Error: ${error.message}`);
  }
}

/**
 * Chat with the sermon transcript.
 * Supports streaming responses for a better user experience.
 */
export async function* streamSermonChat(
  history: { role: 'user' | 'assistant', content: string }[],
  message: string,
  transcript: string
): AsyncGenerator<string> {
  try {
    const contents = [
      {
        role: 'user',
        parts: [{ text: `You are a helpful sermon study assistant. Answer strictly using information from the provided transcript.
        
        Transcript:
        ${transcript}` }]
      },
      ...history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model' as any,
        parts: [{ text: h.content }]
      })),
      {
        role: 'user',
        parts: [{ text: message }]
      }
    ];

    const result = await ai.models.generateContentStream({ 
      model: GEMINI_MODEL,
      contents 
    });

    for await (const chunk of result) {
      const text = chunk.text;
      if (text) yield text;
    }
  } catch (error: any) {
    console.error("Error in streamSermonChat:", error);
    throw new Error(`Failed to chat: ${error.message}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      resolve(base64String.split(',')[1]);
    };
    reader.onerror = error => reject(error);
  });
}

export async function generateGuidedPrompts(
  topic: string,
  keyPoints: string[]
): Promise<string[]> {
  try {
    const prompt = `Based on the following sermon details, generate exactly three (3) highly personalized, introspective, and practical reflection prompts/questions that help a believer apply this sermon to their daily life, relationship with God, and actions this week.
    
    Sermon Topic: ${topic}
    Key Points:
    ${keyPoints.map(p => `- ${p}`).join('\n')}

    Format your response STRICTLY as a JSON array of three strings, like this:
    ["Prompt 1", "Prompt 2", "Prompt 3"]`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map(p => String(p));
    }
    throw new Error("Invalid array format from AI");
  } catch (error) {
    console.error("Error generating guided prompts:", error);
    return [
      `How does the truth of "${topic || 'this sermon'}" challenge your current way of thinking?`,
      `What is one specific action you can take today to apply the key points of this message?`,
      `Spend a moment in prayer: ask the Holy Spirit to reveal any area of your heart that needs alignment with this scripture.`
    ];
  }
}
