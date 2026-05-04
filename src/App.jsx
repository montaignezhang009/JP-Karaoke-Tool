import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  Settings, 
  Music, 
  ChevronRight,
  ListMusic,
  Clock,
  Volume2,
  ClipboardPaste,
  RefreshCcw,
  X,
  VolumeX
} from 'lucide-react';

/**
 * 日文歌教唱工具 - App.jsx
 * 修复：歌词列表强制内部滚动、主显示区域固定不偏移、音量条修复
 */

const App = () => {
  // --- 状态管理 ---
  const [mode, setMode] = useState('setup'); 
  const [audioSrc, setAudioSrc] = useState(null);
  const [rawLyrics, setRawLyrics] = useState('');
  const [lyrics, setLyrics] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pauseOffset, setPauseOffset] = useState(-0.02);
  const [volume, setVolume] = useState(0.8);
  const [autoPause, setAutoPause] = useState(true);
  const [showList, setShowList] = useState(false); 

  const audioRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollContainerRef = useRef(null); 

  // --- LRC 解析逻辑 ---
  const parseLRC = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const lines = text.replace(/：/g, ':').split('\n');
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\]/g;

    lines.forEach(line => {
      const timeMatches = [...line.matchAll(timeReg)];
      const content = line.replace(timeReg, '').trim();
      if (content || timeMatches.length > 0) {
        timeMatches.forEach(match => {
          const m = parseInt(match[1]);
          const s = parseInt(match[2]);
          const msStr = match[3] || '0';
          const ms = parseInt(msStr.padEnd(3, '0'));
          const time = m * 60 + s + ms / 1000;
          result.push({ time, content });
        });
      }
    });

    const sorted = result.sort((a, b) => a.time - b.time);
    return sorted.map((item, index) => {
      const nextTime = sorted[index + 1]?.time || 9999;
      return { ...item, endTime: nextTime };
    });
  }, []);

  // --- Ruby (注音) 渲染 ---
  const renderRubyLine = (text) => {
    if (!text || typeof text !== 'string') return null;
    const parts = text.split(/([^\s\(\)]+\([^\s\(\)]+\))/g);
    return (
      <span className="inline-flex flex-wrap justify-center items-end">
        {parts.map((part, i) => {
          const rubyMatch = part.match(/(.+)\((.+)\)/);
          if (rubyMatch) {
            return (
              <ruby key={i} className="mx-0.5 leading-none">
                {rubyMatch[1]}
                <rt className="text-[0.45em] opacity-90 mb-1 select-none font-sans font-normal">{rubyMatch[2]}</rt>
              </ruby>
            );
          }
          return <span key={i} className="whitespace-pre">{part}</span>;
        })}
      </span>
    );
  };

  const getDynamicFontSize = (text) => {
    if (!text) return 'text-3xl';
    const cleanText = text.replace(/\(.*\)/g, '');
    const len = cleanText.length;
    if (len > 35) return 'text-xl md:text-2xl';
    if (len > 20) return 'text-2xl md:text-3xl';
    return 'text-3xl md:text-5xl';
  };

  // --- 交互功能 ---
  const handleStart = () => {
    const parsed = parseLRC(rawLyrics);
    if (parsed.length === 0) return;
    setLyrics(parsed);
    setMode('practice');
    setCurrentIndex(0);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawLyrics(text);
    } catch (err) {
      textareaRef.current?.focus();
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
  };

  const seekToLine = (index) => {
    if (index < 0 || index >= lyrics.length || !audioRef.current) return;
    setCurrentIndex(index);
    audioRef.current.currentTime = lyrics[index].time;
    audioRef.current.play();
  };

  const replayCurrent = () => {
    if (currentIndex >= 0 && lyrics[currentIndex] && audioRef.current) {
      audioRef.current.currentTime = lyrics[currentIndex].time;
      audioRef.current.play();
    }
  };

  // --- 精确列表自动滚动 ---
  useEffect(() => {
    if (currentIndex >= 0 && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeItem = container.children[currentIndex];
      if (activeItem) {
        // 计算目标滚动位置，使活动项位于容器中间
        const targetScrollTop = activeItem.offsetTop - (container.clientHeight / 2) + (activeItem.clientHeight / 2);
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
      }
    }
  }, [currentIndex, showList]);

  // --- 音频副作用 ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || mode !== 'practice') return;

    const onTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      
      const index = lyrics.findIndex((l, i) => time >= l.time && time < (lyrics[i + 1]?.time || 9999));
      if (index !== -1 && index !== currentIndex) {
        setCurrentIndex(index);
      }

      if (autoPause && currentIndex >= 0 && isPlaying) {
        const currentLine = lyrics[currentIndex];
        if (time >= currentLine.endTime + pauseOffset) {
          audio.pause();
          audio.currentTime = Math.min(currentLine.endTime, audio.duration);
        }
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoadedMetadata = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [lyrics, currentIndex, autoPause, pauseOffset, isPlaying, mode]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // --- UI 渲染 ---

  if (mode === 'setup') {
    return (
      <div className="h-screen w-screen flex items-center justify-center p-4 bg-slate-800 text-slate-100 overflow-hidden">
        <div className="w-full max-w-2xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-700 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-rose-600 rounded-2xl shadow-lg shadow-rose-900/20">
              <Music className="text-white" size={24} />
            </div>
            <h1 className="text-xl font-bold">日文歌教唱 Setup</h1>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">1. 选择歌曲音频</label>
              <div className="relative group">
                <input 
                  type="file" accept="audio/*" 
                  onChange={(e) => e.target.files[0] && setAudioSrc(URL.createObjectURL(e.target.files[0]))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                <div className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center transition-all ${audioSrc ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 group-hover:border-rose-500 bg-slate-950/50'}`}>
                  <Upload className={audioSrc ? 'text-emerald-500' : 'text-slate-500'} size={28} />
                  <p className="mt-2 text-xs text-slate-300 font-medium">{audioSrc ? '音频已就绪' : '点击选择音频文件'}</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">2. 粘贴歌词 (支持 LRC)</label>
                <button 
                  onClick={handlePaste}
                  className="flex items-center gap-1.5 text-[10px] font-black text-rose-400 hover:text-rose-300 transition-colors py-1 px-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 uppercase"
                >
                  <ClipboardPaste size={12} /> 一键粘贴
                </button>
              </div>
              <textarea 
                ref={textareaRef}
                className="w-full h-40 bg-slate-950 border border-slate-700 rounded-2xl p-4 text-slate-100 text-sm font-mono focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all placeholder:text-slate-800 shadow-inner"
                placeholder="[00:15.20]私(わたし)の恋(こい)は..."
                value={rawLyrics}
                onChange={(e) => setRawLyrics(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-700 flex flex-col justify-center">
                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  <Clock size={12} /> 暂停微调 (s): {pauseOffset > 0 ? '+' : ''}{pauseOffset.toFixed(2)}
                </label>
                <input 
                  type="range" min="-0.5" max="0.5" step="0.01" 
                  value={pauseOffset} onChange={(e) => setPauseOffset(parseFloat(e.target.value))}
                  className="w-full accent-rose-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <button 
                onClick={handleStart}
                disabled={!audioSrc || !rawLyrics}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-20 disabled:grayscale text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-900/30 py-4 text-sm"
              >
                开始练习 <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 练习模式 ---

  const currentLine = lyrics[currentIndex] || { content: '', time: 0, endTime: 1 };
  const lineProgress = isPlaying && currentIndex !== -1 
    ? Math.min(100, Math.max(0, ((currentTime - currentLine.time) / (currentLine.endTime - currentLine.time)) * 100))
    : 0;

  return (
    <div className="h-screen w-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row overflow-hidden relative">
      <audio ref={audioRef} src={audioSrc} />
      
      {/* 主练习内容容器 - 关键：h-full 且 flex-1 */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 flex justify-between items-center border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl z-30 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setMode('setup')}
              className="p-2 hover:bg-slate-800 rounded-xl transition-all text-slate-400 hover:text-rose-400 group"
              title="返回设置"
            >
              <RefreshCcw size={20} className="group-hover:rotate-[-45deg] transition-transform" />
            </button>
            <div className="h-4 w-[1px] bg-slate-700" />
            <div className="text-[10px] font-black text-slate-400 tracking-widest uppercase">
              Section {currentIndex + 1} / {lyrics.length}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 音量控制修复 - 在顶部也保持显示 */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
              {volume === 0 ? <VolumeX size={14} className="text-slate-500" /> : <Volume2 size={14} className="text-rose-400" />}
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 accent-rose-500 h-1 bg-slate-700 rounded-full appearance-none cursor-pointer"
              />
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Auto Pause</span>
              <input 
                type="checkbox" checked={autoPause} onChange={(e) => setAutoPause(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-rose-600 cursor-pointer"
              />
            </label>
            <button 
              onClick={() => setShowList(!showList)}
              className={`md:hidden p-2 rounded-xl transition-all ${showList ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:text-rose-400'}`}
            >
              <ListMusic size={20} />
            </button>
          </div>
        </div>

        {/* 歌词区 - 增加了背景对比度，确保绝对不发生位置偏移 */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 relative bg-slate-900/40 overflow-hidden">
          <div className="w-full max-w-4xl text-center space-y-10 md:space-y-16">
            
            {/* 上一句 */}
            <div className="h-10 opacity-30 text-slate-400 text-base md:text-xl transition-all duration-700">
              {currentIndex > 0 && renderRubyLine(lyrics[currentIndex - 1].content)}
            </div>

            {/* 当前句 - 关键位置 */}
            <div className="relative min-h-[180px] md:min-h-[220px] flex items-center justify-center">
              <div className={`font-bold leading-relaxed tracking-wide transition-all duration-300 ${getDynamicFontSize(currentLine.content)} relative`}>
                {/* 底层：静态灰色文字 */}
                <div className="text-slate-600/80">
                  {renderRubyLine(currentLine.content)}
                </div>
                {/* 顶层：进度染色（完全镜像底层） */}
                <div 
                  className="absolute inset-0 flex items-center justify-center text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-pink-500 pointer-events-none select-none"
                  style={{
                    clipPath: `inset(0 ${100 - lineProgress}% 0 0)`,
                    WebkitClipPath: `inset(0 ${100 - lineProgress}% 0 0)`
                  }}
                >
                  {renderRubyLine(currentLine.content)}
                </div>
              </div>
            </div>

            {/* 下一句 */}
            <div className="h-10 opacity-40 text-slate-300 text-base md:text-xl transition-all duration-700">
              {lyrics[currentIndex + 1] && renderRubyLine(lyrics[currentIndex + 1].content)}
            </div>
          </div>
        </div>

        {/* 底部控制面板 - 固定在底部，不随滚动移动 */}
        <div className="bg-slate-900 border-t border-slate-800 p-4 md:px-8 md:py-6 space-y-4 md:space-y-6 z-30 shrink-0 shadow-[0_-10px_50px_rgba(0,0,0,0.4)]">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <span className="text-[9px] font-mono text-slate-500 w-10 text-right">
              {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')}
            </span>
            <div 
              className="flex-1 h-1.5 bg-slate-800 rounded-full relative overflow-hidden cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const p = (e.clientX - rect.left) / rect.width;
                if (audioRef.current) audioRef.current.currentTime = p * duration;
              }}
            >
              <div className="absolute top-0 left-0 h-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]" style={{ width: `${(currentTime / duration) * 100}%` }} />
            </div>
            <span className="text-[9px] font-mono text-slate-500 w-10">
              {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
            </span>
          </div>

          <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-1 md:gap-4">
              <button onClick={() => seekToLine(currentIndex - 1)} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:scale-75">
                <SkipBack size={24} />
              </button>
              <button onClick={replayCurrent} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:rotate-[-90deg]">
                <RotateCcw size={24} />
              </button>
            </div>

            <button 
              onClick={togglePlay}
              className="w-16 h-16 md:w-20 md:h-20 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-rose-900/40 transition-all active:scale-90"
            >
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
            </button>

            <div className="flex items-center gap-1 md:gap-4">
              <button onClick={() => seekToLine(currentIndex + 1)} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 transition-all active:scale-75">
                <SkipForward size={24} />
              </button>
              <button 
                onClick={() => setShowList(!showList)}
                className={`p-3 rounded-2xl transition-all hidden md:block ${showList ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-rose-400'}`}
              >
                <ListMusic size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 歌词列表 - 彻底独立于主内容滚动 */}
      <div 
        className={`
          fixed md:relative top-0 right-0 h-full bg-slate-950 md:bg-slate-900/90 backdrop-blur-3xl 
          border-l border-slate-800 transition-all duration-500 z-50
          ${showList ? 'w-full md:w-80 translate-x-0 opacity-100' : 'w-0 translate-x-full md:w-0 opacity-0 overflow-hidden'}
          flex flex-col
        `}
      >
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2 text-rose-500">
            <ListMusic size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Lyrics Navigator</span>
          </div>
          <button onClick={() => setShowList(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* 精确控制的内部滚动容器 */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-2 custom-scrollbar scroll-smooth bg-slate-950/20"
        >
          {lyrics.map((line, i) => (
            <div 
              key={i}
              onClick={() => seekToLine(i)}
              className={`flex gap-3 p-2.5 rounded-xl cursor-pointer transition-all mb-1 border group ${
                i === currentIndex 
                ? 'bg-rose-600/20 border-rose-500/40 text-rose-300' 
                : 'hover:bg-slate-800/40 border-transparent text-slate-500 hover:text-slate-400'
              }`}
            >
              <span className={`text-[9px] font-mono mt-1 w-5 flex-shrink-0 ${i === currentIndex ? 'text-rose-500' : 'opacity-20'}`}>
                {(i + 1).toString().padStart(2, '0')}
              </span>
              <p className="text-xs font-medium line-clamp-2 leading-relaxed">
                {line.content.replace(/\(.*\)/g, '')}
              </p>
            </div>
          ))}
          {/* 列表底部填充，确保最后一句也能滚动到中间 */}
          <div className="h-[50%]" />
        </div>

        {/* 备用音量控制 (移动端) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 shrink-0">
           <div className="flex items-center gap-4 px-2">
              <Volume2 size={16} className="text-rose-400" />
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 accent-rose-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer"
              />
           </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        ruby rt { font-family: sans-serif; letter-spacing: 0; font-weight: normal; }
        input[type="range"] { -webkit-appearance: none; background: transparent; }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; height: 16px; width: 16px; border-radius: 50%;
          background: #f43f5e; box-shadow: 0 0 10px rgba(244,63,94,0.4); cursor: pointer;
          border: 2px solid #fff;
        }
        /* 禁止 iOS 橡皮筋滚动干扰布局 */
        html, body { height: 100%; overflow: hidden; position: fixed; width: 100%; }
        #root { height: 100%; overflow: hidden; }
      `}</style>
    </div>
  );
};

export default App;
