import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { MicrophoneIcon, CloseIcon } from './icons';

// Utility functions for audio encoding/decoding as per guidelines
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

interface TranscriptEntry {
  speaker: 'user' | 'ai';
  text: string;
}

const API_KEY_BILLING_DOC_LINK = "https://ai.google.dev/gemini-api/docs/billing";

const LiveInteraction: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

  // Audio stream refs
  const audioContextRef = useRef<AudioContext | null>(null);
  // FIX: Removed deprecated `webkitAudioContext` and relied solely on `AudioContext`
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioInputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionRef = useRef<Promise<any> | null>(null); // To hold the live session promise
  const nextStartTimeRef = useRef(0);
  const playbackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Transcription buffers
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const cleanupAudio = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current.onaudioprocess = null;
      scriptProcessorRef.current = null;
    }
    if (audioInputSourceRef.current) {
      audioInputSourceRef.current.disconnect();
      audioInputSourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
        // Stop all pending audio playback
        playbackSourcesRef.current.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                // Audio might have already ended, safe to ignore
            }
        });
        playbackSourcesRef.current.clear();
        nextStartTimeRef.current = 0;
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
  }, []);

  const handleLiveError = useCallback((error: any) => {
    console.error("Gemini Live API Error:", error);
    let errorMessage = "An error occurred with the AI conversation. Please try again.";

    if (error.toString().includes('RESOURCE_EXHAUSTED') || error.toString().includes('429')) {
      errorMessage = "AI quota exhausted. Please check your billing.";
    } else if (error.toString().includes('Requested entity was not found.')) {
        // This usually means the API key is invalid or not selected.
        errorMessage = "API key issue detected. Please select or update your API key.";
        setIsApiKeyMissing(true);
    }
    setApiError(errorMessage);
    setIsLoadingResponse(false);
    setIsRecording(false);
    cleanupAudio();
  }, [cleanupAudio]);

  const startConversation = useCallback(async () => {
    setMicrophoneError(null);
    setApiError(null);
    setIsLoadingResponse(false);
    setIsApiKeyMissing(false);
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
    setTranscript([]);

    if (!(window as any).aistudio?.hasSelectedApiKey) {
        setApiError("API Key selection utility not available.");
        return;
    }

    let apiKeySelected = await (window as any).aistudio.hasSelectedApiKey();
    if (!apiKeySelected) {
      setIsApiKeyMissing(true);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Initialize audio contexts
      // FIX: Removed deprecated `webkitAudioContext` and relied solely on `AudioContext`
      inputAudioContextRef.current = new window.AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new window.AudioContext({ sampleRate: 24000 });

      const source = inputAudioContextRef.current.createMediaStreamSource(stream);
      scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

      scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        sessionRef.current?.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };

      source.connect(scriptProcessorRef.current);
      scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);

      setIsRecording(true);
      setIsLoadingResponse(true); // Assume loading response until the first AI audio/transcription

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      sessionRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.debug('Live session opened');
            setApiError(null);
            setIsApiKeyMissing(false); // Clear API key errors on successful connection
          },
          onmessage: async (message: LiveServerMessage) => {
            setIsLoadingResponse(true); // Keep loading if new message comes in

            if (message.serverContent?.outputTranscription) {
              currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.inputTranscription) {
              currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const fullInputText = currentInputTranscriptionRef.current.trim();
              const fullOutputText = currentOutputTranscriptionRef.current.trim();
              
              setTranscript(prev => {
                const newTranscript = [...prev];
                if (fullInputText) {
                    newTranscript.push({ speaker: 'user', text: fullInputText });
                }
                if (fullOutputText) {
                    newTranscript.push({ speaker: 'ai', text: fullOutputText });
                }
                return newTranscript;
              });

              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
              setIsLoadingResponse(false); // Only set to false after a full turn is complete
            }

            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64EncodedAudioString && outputAudioContextRef.current) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
              try {
                const audioBuffer = await decodeAudioData(
                  decode(base64EncodedAudioString),
                  outputAudioContextRef.current,
                  24000,
                  1,
                );
                const sourceNode = outputAudioContextRef.current.createBufferSource();
                sourceNode.buffer = audioBuffer;
                sourceNode.connect(outputAudioContextRef.current.destination);
                sourceNode.addEventListener('ended', () => {
                  playbackSourcesRef.current.delete(sourceNode);
                });

                sourceNode.start(nextStartTimeRef.current);
                nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
                playbackSourcesRef.current.add(sourceNode);
              } catch (decodeError) {
                console.error("Error decoding audio data:", decodeError);
              }
            }

            if (message.serverContent?.interrupted) {
              playbackSourcesRef.current.forEach(source => {
                try {
                    source.stop();
                } catch (e) {
                    // Audio might have already ended, safe to ignore
                }
              });
              playbackSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            handleLiveError(e.error);
          },
          onclose: (e: CloseEvent) => {
            console.debug('Live session closed:', e.code, e.reason);
            setIsRecording(false);
            setIsLoadingResponse(false);
            cleanupAudio();
            if (e.code === 1006) { // Abnormal closure, often indicates API issue
                setApiError("Connection unexpectedly closed. Please try again or check API key.");
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are AutoMind AI, a friendly, conversational, and super-knowledgeable car enthusiast and expert mechanic. You are designed for real-time voice conversations. Keep responses concise and engaging.',
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
      }).catch((e: Error) => {
        handleLiveError(e);
      });

    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicrophoneError("Microphone access denied. Please enable it in your browser settings to use live voice features.");
      } else {
        setMicrophoneError("Could not access microphone: " + err.message);
      }
      setIsRecording(false);
      setIsLoadingResponse(false);
      cleanupAudio();
    }
  }, [cleanupAudio, handleLiveError]);

  const stopConversation = useCallback(() => {
    sessionRef.current?.then((session) => {
      session.close();
    });
    setIsRecording(false);
    setIsLoadingResponse(false);
    cleanupAudio();
  }, [cleanupAudio]);

  const handleApiKeySelection = async () => {
    if ((window as any).aistudio?.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
        // Assume key selection was successful, try starting conversation again
        setIsApiKeyMissing(false);
        setApiError(null);
        startConversation(); 
    } else {
        setApiError("API Key selection utility not available.");
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopConversation();
    };
  }, [stopConversation]);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, isLoadingResponse]);

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-150px)] bg-brand-dark-2 rounded-lg border border-gray-700">
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
        {transcript.length === 0 && !isRecording && !microphoneError && !apiError && !isApiKeyMissing && (
          <div className="text-center text-brand-gray mt-12">
            <MicrophoneIcon className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <p className="text-lg font-semibold">Start a live voice conversation with AutoMind AI.</p>
            <p className="text-sm mt-2">I'm ready to talk about anything car-related!</p>
          </div>
        )}

        {transcript.map((entry, index) => (
          <div key={index} className="mb-4">
            <div className={`flex items-start gap-3 ${entry.speaker === 'user' ? 'justify-end' : ''}`}>
              {entry.speaker === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-brand-blue flex-shrink-0 flex items-center justify-center font-bold text-sm">
                  AI
                </div>
              )}
              <div
                className={`max-w-md p-3 rounded-lg ${
                  entry.speaker === 'user'
                    ? 'bg-brand-blue text-white'
                    : 'bg-gray-700 text-gray-200'
                }`}
                role="status"
                aria-live="polite"
              >
                <p className="text-sm">{entry.text}</p>
              </div>
            </div>
          </div>
        ))}

        {isRecording && isLoadingResponse && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-blue flex-shrink-0 flex items-center justify-center font-bold text-sm">
              AI
            </div>
            <div className="max-w-md p-3 rounded-lg bg-gray-700 text-gray-200">
              <div className="flex items-center space-x-1" aria-label="AI is thinking">
                <span className="text-sm">AutoMind is speaking</span>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse-fast [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse-fast [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse-fast"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={transcriptEndRef} />
      </div>

      <div className="p-4 border-t border-gray-700 flex flex-col items-center">
        {microphoneError && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4 w-full flex justify-between items-center" role="alert">
            <div className="flex items-start">
              <svg className="fill-current h-6 w-6 text-red-500 mr-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              <div>
                <p className="font-bold">Microphone Error</p>
                <p className="text-sm">{microphoneError}</p>
              </div>
            </div>
            <button
              onClick={() => setMicrophoneError(null)}
              className="text-red-200 hover:text-white transition-colors ml-4 flex-shrink-0"
              aria-label="Dismiss error"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        )}
        {apiError && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4 w-full flex justify-between items-center" role="alert">
            <div className="flex items-start">
              <svg className="fill-current h-6 w-6 text-red-500 mr-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              <div>
                <p className="font-bold">AI Service Error</p>
                <p className="text-sm">{apiError}</p>
                {isApiKeyMissing && (
                    <button 
                        onClick={handleApiKeySelection}
                        className="mt-2 text-brand-blue font-semibold hover:underline"
                        aria-label="Select API Key"
                    >
                        Select/Update API Key
                    </button>
                )}
                <p className="text-xs mt-1">
                    <a href={API_KEY_BILLING_DOC_LINK} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Billing information</a>
                </p>
              </div>
            </div>
            <button
              onClick={() => setApiError(null)}
              className="text-red-200 hover:text-white transition-colors ml-4 flex-shrink-0"
              aria-label="Dismiss error"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        <button
          onClick={isRecording ? stopConversation : startConversation}
          className={`flex items-center justify-center w-64 h-12 rounded-full font-bold text-white transition-all duration-300
            ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-blue hover:bg-blue-600'}
            ${isRecording && isLoadingResponse ? 'animate-pulse-fast' : ''}
          `}
          aria-label={isRecording ? "End conversation" : "Start conversation"}
          aria-pressed={isRecording}
          disabled={isApiKeyMissing}
        >
          <MicrophoneIcon className={`w-6 h-6 mr-2 ${isRecording && 'text-red-100'}`} />
          {isRecording ? (isLoadingResponse ? 'Speaking...' : 'Listening...') : 'Start Conversation'}
        </button>
        {isApiKeyMissing && (
            <p className="text-sm text-yellow-400 mt-2" role="alert">
                An API key is required to use Live features. Please select one.
            </p>
        )}
      </div>
    </div>
  );
};

export default LiveInteraction;