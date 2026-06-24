import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserNote } from '../types';
import { Button } from './Button';
import { Mic, StopCircle, X, Send, StickyNote, RotateCcw, Waves, Sparkles, Heart, Clock } from 'lucide-react';
import { saveLiveDraft, getLiveDraft, clearLiveDraft } from '../services/storageService';
import { LONG_RECORDING_WARN_SECONDS } from '../constants/ai';
import { downloadBlob } from '../services/recordingStore';
import { SermonSpeakerFields } from './SermonSpeakerFields';
import { speakerInputToMeta, type SermonSpeakerMeta } from '../lib/speakerMeta';
import { loadSpeakerPrefs, saveSpeakerPrefs } from '../services/speakerPrefs';
import { motion, AnimatePresence } from 'motion/react';

interface AudioRecorderProps {
  onStopRecording: (
    transcript: string,
    notes?: UserNote[],
    file?: File,
    speaker?: SermonSpeakerMeta,
  ) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onStopRecording, onCancel, isLoading, error }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);
  const [liveNotes, setLiveNotes] = useState<UserNote[]>([]);
  const liveNotesRef = useRef<UserNote[]>([]);
  const [currentDraftNote, setCurrentDraftNote] = useState<string>('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [speaker, setSpeaker] = useState(loadSpeakerPrefs);
  const wakeLockRef = useRef<any>(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err: any) {
      console.warn('Wake Lock error:', err.message);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current !== null) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err: any) {
        console.warn('Wake Lock release error:', err.message);
      }
    }
  };
  
  useEffect(() => {
    liveNotesRef.current = liveNotes;
    if (isRecording || liveNotes.length > 0) {
      saveLiveDraft(liveNotes);
    }
  }, [liveNotes, isRecording]);

  useEffect(() => {
    const fetchDraft = async () => {
      const draft = await getLiveDraft();
      if (draft.length > 0) {
        setLiveNotes(draft);
      }
    };
    fetchDraft();
  }, []);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioQuality, setAudioQuality] = useState<'quiet' | 'good' | 'loud' | 'none'>('none');

  const startVisualizer = (stream: MediaStream) => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    
    analyser.fftSize = 128;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;

    const draw = () => {
      if (!canvasRef.current || !analyserRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, width, height);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      if (average < 10) setAudioQuality('quiet');
      else if (average > 120) setAudioQuality('loud');
      else setAudioQuality('good');

      const barWidth = (width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)'); // Indigo-500/20
        gradient.addColorStop(1, 'rgba(251, 191, 36, 0.8)'); // Amber-400
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, barWidth, barHeight, 4);
        ctx.fill();

        x += barWidth + 4;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    setAudioQuality('none');
  };

  const addLiveNote = () => {
    if (!currentDraftNote.trim()) return;
    const newNote: UserNote = {
      id: crypto.randomUUID(),
      text: currentDraftNote,
      timestamp: Date.now(),
      timestamp_offset: recordingDuration,
    };
    setLiveNotes(prev => [...prev, newNote]);
    setCurrentDraftNote('');
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Safe initialization with ultra-lightweight voice compression (32kbps)
      let mediaRecorder: MediaRecorder;
      try {
        const options = {
          audioBitsPerSecond: 32000 // Voice is extremely clear at 32kbps but keeps file size extremely lightweight (10MB for 45-min)
        };
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        console.warn('Low-bitrate MediaRecorder not supported, falling back to browser default:', e);
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstart = () => {
        setIsRecording(true);
        setRecordingDuration(0);
        requestWakeLock();
        
        // Isolate visualizer initialization so visualizer exceptions never crash the recording process
        try {
          startVisualizer(stream);
        } catch (visErr) {
          console.warn('Could not start audio visualizer:', visErr);
        }

        intervalRef.current = window.setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsFinishing(true);
        stopVisualizer();
        releaseWakeLock();
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        try {
          // Dynamic MIME and File Extension resolution for Apple/mobile compatibility
          const recordedMimeType = mediaRecorder.mimeType || 'audio/webm';
          
          // Clean the MIME type by stripping parameters like codecs (Gemini strict format)
          const baseMimeType = recordedMimeType.split(';')[0].trim();
          
          // Map to correct file extension
          let extension = 'webm';
          if (baseMimeType.includes('mp4')) extension = 'mp4';
          else if (baseMimeType.includes('aac')) extension = 'aac';
          else if (baseMimeType.includes('ogg')) extension = 'ogg';
          else if (baseMimeType.includes('wav')) extension = 'wav';
          else if (baseMimeType.includes('mpeg')) extension = 'mp3';

          const audioBlob = new Blob(audioChunksRef.current, { type: baseMimeType });
          const audioFile = new File([audioBlob], `live-sermon-${Date.now()}.${extension}`, { type: baseMimeType });

          // Backup download so a failed transcription does not lose the sermon
          if (audioBlob.size > 0) {
            downloadBlob(audioBlob, audioFile.name);
          }

          saveSpeakerPrefs(speaker);
          const speakerMeta = speakerInputToMeta(speaker);
          await onStopRecording('', liveNotesRef.current, audioFile, speakerMeta);
          await clearLiveDraft();
        } catch (err) {
          console.error('Error finishing live recording:', err);
        } finally {
          setIsFinishing(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      };

      // Timeslice: flush audio every 10s so long sermons don't lose everything in memory
      mediaRecorder.start(10_000);
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Could not start recording. Please ensure microphone access is granted.');
      setIsRecording(false);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    }
  }, [onStopRecording, liveNotes, speaker]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  useEffect(() => {
    return () => {
      stopVisualizer();
      releaseWakeLock();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in duration-700">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12">
        
        {/* ── Sacred Recorder ── */}
        <div className="sacred-card p-12 border-t-8 border-t-rose-600 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Subtle Background Glow */}
          {isRecording && (
            <div className="absolute inset-0 bg-rose-50/20 animate-pulse pointer-events-none" />
          )}

          <div className="relative z-10 text-center w-full">
            <div className="inline-flex items-center space-x-2 bg-rose-50 px-4 py-2 rounded-full mb-8">
               <Heart className={`w-4 h-4 ${isRecording ? 'text-rose-600 animate-pulse' : 'text-rose-200'}`} />
               <span className="text-[10px] font-black text-rose-900 uppercase tracking-widest">
                  {isRecording ? 'Scribing the Word' : 'Sacred Listening'}
               </span>
            </div>

            <h2 className="text-4xl font-serif font-black text-indigo-950 mb-4 tracking-tight leading-none">
              {isRecording ? 'Capturing Wisdom' : 'Begin Recording'}
            </h2>

            {!isRecording && (
              <div className="w-full max-w-md mx-auto text-left">
                <SermonSpeakerFields
                  value={speaker}
                  onChange={setSpeaker}
                  disabled={isLoading || isFinishing}
                  compact
                />
              </div>
            )}

            <div className="flex flex-col items-center justify-center w-full my-12">
              <div className="relative w-56 h-56 flex items-center justify-center">
                <AnimatePresence>
                  {isRecording && (
                    <motion.div 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.2, opacity: 0.15 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-full bg-rose-500" 
                    />
                  )}
                </AnimatePresence>
                
                <button 
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  className={`
                    relative w-40 h-40 rounded-[48px] flex items-center justify-center transition-all duration-500 z-10 shadow-2xl active:scale-95
                    ${isRecording 
                      ? 'bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700' 
                      : 'bg-indigo-900 text-white shadow-indigo-100 hover:bg-indigo-800'}
                  `}
                >
                  {isRecording ? <StopCircle className="w-16 h-16" /> : <Mic className="w-16 h-16" />}
                </button>
              </div>

              {isRecording && recordingDuration >= 30 * 60 && recordingDuration < LONG_RECORDING_WARN_SECONDS && (
                <p className="mt-4 text-sm font-bold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
                  30+ minutes recorded — transcription may take 10–15 minutes after you finish.
                </p>
              )}
              {isRecording && recordingDuration >= LONG_RECORDING_WARN_SECONDS && (
                <p className="mt-4 text-sm font-bold text-amber-800 bg-amber-50 px-4 py-3 rounded-xl border border-amber-200 max-w-md mx-auto leading-relaxed">
                  Long sermon: after you finish, Whisper transcribes when available (15–20 min).
                  For 45+ min, Voice Memos → <strong>Paste Text</strong> is most reliable — or finish here; your audio downloads as a backup.
                </p>
              )}

              {isRecording && (
                <div className="w-full mt-12 flex flex-col items-center">
                  <canvas 
                    ref={canvasRef} 
                    width={320} 
                    height={80} 
                    className="rounded-2xl opacity-80 pointer-events-none"
                  />
                  <div className="mt-6 flex items-center space-x-2 bg-white/50 px-3 py-1.5 rounded-full border border-indigo-50 shadow-sm">
                    <div className={`w-2 h-2 rounded-full ${
                      audioQuality === 'good' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                      audioQuality === 'quiet' ? 'bg-amber-500' : 
                      audioQuality === 'loud' ? 'bg-rose-500' : 'bg-indigo-100'
                    }`} />
                    <span className="text-[10px] font-black text-indigo-900/40 uppercase tracking-widest">
                      {audioQuality === 'good' ? 'Perfect Clarity' : 
                       audioQuality === 'quiet' ? 'Whisper Quiet' : 
                       audioQuality === 'loud' ? 'Distorted (Loud)' : 'Awakening...'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-center mb-12">
              <div className="flex items-center justify-center space-x-2 mb-2">
                 <Clock className="w-5 h-5 text-indigo-300" />
                 <span className="text-4xl font-serif font-black text-indigo-950 tracking-tight">
                    {formatTime(recordingDuration)}
                 </span>
              </div>
              <p className="text-sm font-serif italic text-indigo-900/40">
                {isRecording
                  ? 'Step 1: record — then we transcribe to editable text (study guide comes after you review).'
                  : 'Record the sermon, transcribe to text, edit if needed, then build your study guide.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row w-full gap-4">
              {(isRecording || isFinishing) && (
                <button
                  onClick={stopRecording}
                  disabled={isLoading || isFinishing}
                  className="btn-sacred-primary flex-1 py-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-80"
                >
                  {isFinishing || isLoading
                    ? 'Transcribing… (keep screen on)'
                    : 'Finish → Transcribe to Text'}
                </button>
              )}
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="btn-sacred-ghost flex-1 py-4 bg-white/50"
              >
                Cancel Journey
              </button>
            </div>
          </div>
        </div>

        {/* ── Live Manuscript (Notes) ── */}
        <div className="sacred-card p-12 border border-indigo-50 flex flex-col h-full">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center space-x-3">
               <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <StickyNote className="w-5 h-5 text-indigo-400" />
               </div>
               <h3 className="text-2xl font-serif font-black text-indigo-950">Live Reflections</h3>
            </div>
            
            <div className="flex items-center space-x-3">
              {liveNotes.length > 0 && (
                <button 
                  onClick={async () => {
                    if (confirm('Clear these reflections?')) {
                      setLiveNotes([]);
                      await clearLiveDraft();
                    }
                  }}
                  className="p-2 text-indigo-200 hover:text-rose-600 hover:bg-rose-50 transition-all rounded-xl"
                  title="Clear manuscript"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              )}
              <span className="bg-amber-50 text-amber-900 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm">
                {liveNotes.length} Insights
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto mb-8 space-y-6 pr-2 scrollbar-hide min-h-[300px]">
            <AnimatePresence initial={false}>
              {liveNotes.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12"
                >
                  <Sparkles className="w-12 h-12 text-indigo-50 mb-6" />
                  <p className="text-lg font-serif italic text-indigo-900/20 max-w-[240px]">
                    Note down what moves you. They'll be timestamped to the Word.
                  </p>
                </motion.div>
              ) : (
                [...liveNotes].reverse().map((note) => (
                  <motion.div 
                    key={note.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-indigo-50/30 p-6 rounded-[24px] border border-indigo-50/50 group hover:border-amber-200 transition-all"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black text-indigo-900/30 uppercase tracking-[0.2em] flex items-center">
                        <Waves className="w-3.5 h-3.5 mr-2 text-amber-400" />
                        At {formatTime(note.timestamp_offset || 0)}
                      </span>
                    </div>
                    <p className="text-indigo-950 font-serif text-lg leading-relaxed">{note.text}</p>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="relative mt-auto pt-6 border-t border-indigo-50">
            <input
              type="text"
              value={currentDraftNote}
              onChange={(e) => setCurrentDraftNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLiveNote()}
              placeholder="Capture an insight..."
              disabled={!isRecording}
              className="w-full p-6 pr-16 bg-white border-2 border-indigo-50 rounded-[28px] font-serif text-lg text-indigo-950 placeholder:text-indigo-100 focus:outline-none focus:border-indigo-900 transition-all disabled:opacity-30 shadow-inner"
            />
            <button
              onClick={addLiveNote}
              disabled={!isRecording || !currentDraftNote.trim()}
              className="absolute right-4 top-[2.25rem] p-3 bg-indigo-900 text-amber-200 rounded-2xl hover:bg-indigo-800 transition-all disabled:grayscale shadow-lg shadow-indigo-100 active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-rose-600 text-white px-8 py-4 rounded-[24px] shadow-2xl flex items-center space-x-3 z-50 font-black tracking-tight"
        >
          <X className="w-5 h-5" />
          <span>{error}</span>
        </motion.div>
      )}
    </div>
  );
};