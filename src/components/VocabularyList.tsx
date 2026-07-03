import React, { useState, useEffect } from "react";
import { AppUser, VocabularySet, Progress, Subject } from "../types";
import { subscribeToVocabularySets, subscribeToSubjects } from "../services/flashcardService";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getVNDateString } from "../utils/timezone";
import { checkAndTriggerDailyReset } from "../services/googleSheetsService";
import { 
  BookOpen, 
  Sparkles, 
  CheckCircle, 
  Flame, 
  ArrowRight, 
  ArrowLeft,
  BookMarked, 
  BrainCircuit, 
  Layers,
  Star,
  GraduationCap,
  ChevronRight
} from "lucide-react";

interface VocabularyListProps {
  user: AppUser;
  onSelectSet: (set: VocabularySet) => void;
}

// GenZ Vibrant Style Helper for Subjects
const getSubjectStyle = (name: string, index: number) => {
  const normalizedName = name.toLowerCase();
  
  const styles = [
    {
      gradient: "from-pink-500 via-rose-500 to-amber-400",
      glow: "shadow-pink-500/20 hover:shadow-pink-500/40 hover:ring-pink-400",
      bgLight: "bg-pink-50/70",
      bgGlow: "bg-pink-500/10",
      text: "text-pink-600",
      border: "border-pink-200/60 hover:border-pink-500",
      emoji: "🇬🇧 💬",
      tagColor: "bg-pink-100 text-pink-700 border-pink-200",
      btnTheme: "bg-pink-500 hover:bg-pink-600 shadow-pink-500/20 text-white",
      iconColor: "text-pink-500"
    },
    {
      gradient: "from-violet-600 via-fuchsia-500 to-pink-500",
      glow: "shadow-fuchsia-500/20 hover:shadow-fuchsia-500/40 hover:ring-fuchsia-400",
      bgLight: "bg-fuchsia-50/70",
      bgGlow: "bg-fuchsia-500/10",
      text: "text-fuchsia-600",
      border: "border-fuchsia-200/60 hover:border-fuchsia-500",
      emoji: "⚡ 📐",
      tagColor: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
      btnTheme: "bg-fuchsia-500 hover:bg-fuchsia-600 shadow-fuchsia-500/20 text-white",
      iconColor: "text-fuchsia-500"
    },
    {
      gradient: "from-emerald-400 via-teal-500 to-cyan-500",
      glow: "shadow-teal-500/20 hover:shadow-teal-500/40 hover:ring-emerald-400",
      bgLight: "bg-emerald-50/70",
      bgGlow: "bg-emerald-500/10",
      text: "text-emerald-600",
      border: "border-emerald-200/60 hover:border-emerald-500",
      emoji: "🌍 🌴",
      tagColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
      btnTheme: "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 text-white",
      iconColor: "text-emerald-500"
    },
    {
      gradient: "from-orange-500 via-red-500 to-amber-500",
      glow: "shadow-orange-500/20 hover:shadow-orange-500/40 hover:ring-orange-400",
      bgLight: "bg-orange-50/70",
      bgGlow: "bg-orange-500/10",
      text: "text-orange-600",
      border: "border-orange-200/60 hover:border-orange-500",
      emoji: "🏛️ 📜",
      tagColor: "bg-orange-100 text-orange-700 border-orange-200",
      btnTheme: "bg-orange-500 hover:bg-orange-600 shadow-orange-500/20 text-white",
      iconColor: "text-orange-500"
    },
    {
      gradient: "from-cyan-500 via-blue-500 to-indigo-600",
      glow: "shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:ring-cyan-400",
      bgLight: "bg-cyan-50/70",
      bgGlow: "bg-cyan-500/10",
      text: "text-cyan-600",
      border: "border-cyan-200/60 hover:border-cyan-500",
      emoji: "🧪 ⚗️",
      tagColor: "bg-cyan-100 text-cyan-700 border-cyan-200",
      btnTheme: "bg-cyan-500 hover:bg-cyan-600 shadow-cyan-500/20 text-white",
      iconColor: "text-cyan-500"
    }
  ];

  if (normalizedName.includes("anh") || normalizedName.includes("english")) return styles[0];
  if (normalizedName.includes("toán") || normalizedName.includes("math")) return styles[1];
  if (normalizedName.includes("địa") || normalizedName.includes("geo")) return styles[2];
  if (normalizedName.includes("sử") || normalizedName.includes("lịch") || normalizedName.includes("his")) return styles[3];
  if (normalizedName.includes("hóa") || normalizedName.includes("chem")) return styles[4];
  
  return styles[index % styles.length];
};

export default function VocabularyList({ user, onSelectSet }: VocabularyListProps) {
  const [sets, setSets] = useState<VocabularySet[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [todayProgress, setTodayProgress] = useState<{ [setId: string]: Progress }>({});
  const [todayStr] = useState(() => getVNDateString());

  // Subjects state & navigation selection state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // Daily random words state
  const [dailyWords, setDailyWords] = useState<any[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);

  // Auto-reset check and fetch today's 20 random words
  useEffect(() => {
    const fetchDailyWords = async () => {
      setLoadingDaily(true);
      try {
        const state = await checkAndTriggerDailyReset();
        if (state && Array.isArray(state.activeWords)) {
          setDailyWords(state.activeWords);
        } else {
          setDailyWords([]);
        }
      } catch (err) {
        console.error("Lỗi khi đồng bộ từ vựng ngẫu nhiên hàng ngày:", err);
      } finally {
        setLoadingDaily(false);
      }
    };
    fetchDailyWords();
  }, []);

  // Subscribe to all vocabulary sets real-time
  useEffect(() => {
    setLoadingSets(true);
    const unsubscribe = subscribeToVocabularySets((allSets) => {
      setSets(allSets);
      setLoadingSets(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to active subjects
  useEffect(() => {
    const unsubscribe = subscribeToSubjects((allSubjects) => {
      setSubjects(allSubjects.filter(sub => sub.isActive));
    });
    return () => unsubscribe();
  }, []);

  // Listen to ALL user progress documents for today in a single listener
  useEffect(() => {
    const progressCol = collection(db, "progress");
    const q = query(
      progressCol,
      where("uid", "==", user.uid),
      where("date", "==", todayStr)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const progressMap: { [setId: string]: Progress } = {};
      snapshot.forEach((docSnap) => {
        const prog = docSnap.data() as Progress;
        progressMap[prog.setId] = prog;
      });
      setTodayProgress(progressMap);
    });

    return () => unsubscribe();
  }, [user.uid, todayStr]);

  if (loadingSets) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-fuchsia-500/20 border-t-fuchsia-500 animate-spin"></div>
          <div className="absolute inset-1.5 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin [animation-duration:1.5s]"></div>
        </div>
        <p className="text-sm font-sans font-bold tracking-wide animate-pulse bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
          VŨ TRỤ ĐANG TẢI BÀI HỌC... 🚀
        </p>
      </div>
    );
  }

  // Count completed sets today
  const completedSetsCount = Object.values(todayProgress).filter((p: Progress) => p.isCompleted).length;

  // Compute sets belonging to the currently selected subject
  const filteredSets = selectedSubject
    ? sets.filter(s => s.subjectId === selectedSubject.id)
    : [];

  // Helper to fetch metrics for a given subject
  const getSubjectMetrics = (subjectId: string) => {
    const subjectSets = sets.filter(s => s.subjectId === subjectId);
    const totalSets = subjectSets.length;
    const completed = subjectSets.filter(s => todayProgress[s.id]?.isCompleted).length;
    const isCompletedAll = totalSets > 0 && completed === totalSets;
    return { totalSets, completed, isCompletedAll };
  };

  const dailyProgress = todayProgress["daily_random_set"];
  const dailyCompletedCount = dailyProgress ? dailyProgress.completedWords.length : 0;
  const isDailyCompleted = !!(dailyProgress && dailyProgress.isCompleted);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      
      {/* 1. SUBJECT LIST VIEW (WHEN NO SUBJECT SELECTED) */}
      {!selectedSubject ? (
        <div className="space-y-10">
          {/* Main Hero Banner with custom colors & neon gradients */}
          <div className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 rounded-3xl p-8 sm:p-10 mb-2 shadow-2xl relative overflow-hidden text-white border-4 border-white/10">
            <div className="absolute -top-12 -right-12 w-80 h-80 bg-white/10 rounded-full filter blur-2xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-cyan-400/20 rounded-full filter blur-3xl pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
              <div>
                <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
                  <span className="bg-white/20 text-white text-[10px] sm:text-xs px-3 py-1 rounded-full font-black tracking-widest uppercase border border-white/20 flex items-center gap-1.5 shadow-sm">
                    <Star className="h-3 w-3 fill-white animate-bounce" /> SIÊU VŨ TRỤ HỌC TẬP
                  </span>
                  <span className="flex items-center gap-1 bg-amber-400/25 border border-amber-300/30 text-amber-200 text-[10px] sm:text-xs px-3 py-1 rounded-full font-black">
                    <Flame className="h-4 w-4 fill-amber-300 animate-pulse text-amber-300" /> PHIÊN HỌC CHÁY MÁY
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-sans font-black text-white tracking-tight leading-tight drop-shadow-sm">
                  Học Tập Cực Đỉnh, <br className="hidden sm:inline" /> Rinh Chuỗi Streak Xịn! 🦄
                </h2>
                <p className="text-sm sm:text-base text-fuchsia-50 mt-3 max-w-2xl leading-relaxed font-medium">
                  Chọn ngay môn học bạn muốn chinh phục bên dưới. Học và đánh dấu <span className="font-bold underline decoration-amber-400 decoration-2">"Đã nhớ"</span> toàn bộ từ vựng để bùng nổ chuỗi học tập cùng bạn bè nha!
                </p>
              </div>

              {/* Progress Summary Widget */}
              <div className="bg-white/10 border border-white/20 backdrop-blur-xl p-5 sm:p-6 rounded-3xl flex items-center gap-4.5 min-w-[240px] shadow-2xl transform hover:scale-105 transition-transform duration-300">
                <div className="p-4 bg-gradient-to-br from-amber-300 to-orange-400 text-slate-950 rounded-2xl shadow-lg animate-pulse">
                  <BrainCircuit className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-[10px] text-fuchsia-100 font-sans font-black tracking-wider uppercase">ĐÃ XONG HÔM NAY</p>
                  <p className="text-2xl font-black text-white leading-tight mt-0.5">
                    {completedSetsCount} Bộ Từ Vựng
                  </p>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-bold mt-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Real-time 100%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Subjects Grid Header */}
          <div className="text-center sm:text-left">
            <h3 className="font-sans font-black text-2xl sm:text-3xl text-slate-900 tracking-tight flex items-center justify-center sm:justify-start gap-2.5">
              <span>Hôm Nay Học Gì Thế?</span> 
              <span className="text-3xl animate-bounce">👇</span>
            </h3>
            <p className="text-sm text-slate-500 font-bold mt-1.5">
              Click vào một môn học bên dưới để bứt phá giới hạn bản thân!
            </p>
          </div>

          {/* Interactive Subject Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((sub, idx) => {
              const style = getSubjectStyle(sub.name, idx);
              const { totalSets, completed, isCompletedAll } = getSubjectMetrics(sub.id);

              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSubject(sub)}
                  className={`bg-white border-2 ${style.border} ${style.glow} rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group cursor-pointer hover:-translate-y-2 hover:ring-4 hover:ring-opacity-20`}
                >
                  <div>
                    {/* Subject Header Visual */}
                    <div className="flex items-center justify-between mb-6">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-2xl shadow-lg transform group-hover:rotate-6 transition-transform`}>
                        {style.emoji.split(" ")[0]}
                      </div>
                      
                      {/* Completion Progress Badges */}
                      {isCompletedAll ? (
                        <span className="bg-emerald-500 border border-emerald-400 text-white text-[10px] font-black py-1 px-3 rounded-full flex items-center gap-1 shadow-sm uppercase tracking-wider animate-bounce">
                          🔥 PHÁ ĐẢO 100%
                        </span>
                      ) : totalSets === 0 ? (
                        <span className="bg-slate-100 border border-slate-200 text-slate-400 text-[10px] font-bold py-1 px-3 rounded-full">
                          SẮP RA MẮT ⏳
                        </span>
                      ) : completed > 0 ? (
                        <span className="bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-black py-1 px-3 rounded-full uppercase tracking-wider">
                          ⚡ ĐANG CHIẾN: {completed}/{totalSets}
                        </span>
                      ) : (
                        <span className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-black py-1 px-3 rounded-full uppercase tracking-wider">
                          🎯 CHƯA HỌC
                        </span>
                      )}
                    </div>

                    {/* Subject Metadata */}
                    <h4 className="font-sans font-black text-xl text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                      Môn {sub.name}
                    </h4>
                    <p className="text-xs text-slate-400 font-bold mt-1 font-mono tracking-wide uppercase">
                      Chủ đề khả dụng: {totalSets} bộ flashcard
                    </p>
                  </div>

                  {/* Playful progress footer */}
                  <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-black flex items-center gap-1">
                      <GraduationCap className={`h-4 w-4 ${style.iconColor}`} />
                      {totalSets > 0 ? `Bấm để xem bài học` : `Đang soạn nội dung`}
                    </span>
                    <div className={`w-8 h-8 rounded-xl ${style.bgGlow} flex items-center justify-center text-indigo-600 transform group-hover:translate-x-1.5 transition-transform duration-300`}>
                      <ChevronRight className={`h-5 w-5 ${style.iconColor}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        
        /* 2. FLASHCARD SETS LIST VIEW (WHEN A SUBJECT IS SELECTED) */
        <div className="space-y-8 animate-fadeIn">
          
          {/* Custom Vibrant Header for Selected Subject */}
          {(() => {
            const style = getSubjectStyle(selectedSubject.name, subjects.indexOf(selectedSubject));
            const { totalSets, completed } = getSubjectMetrics(selectedSubject.id);

            return (
              <>
                {/* Back button with bounce and glowing outline */}
                <div className="flex">
                  <button
                    onClick={() => setSelectedSubject(null)}
                    className="group px-5 py-3 bg-white hover:bg-slate-950 hover:text-white border-2 border-slate-200 hover:border-slate-950 text-slate-700 rounded-2xl text-xs font-black transition-all duration-300 shadow-md hover:shadow-xl flex items-center gap-2 cursor-pointer transform active:scale-95"
                  >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform text-rose-500" />
                    QUAY LẠI CHỌN MÔN HỌC KHÁC
                  </button>
                </div>

                {/* Banner customized based on subject's color palette */}
                <div className={`bg-gradient-to-r ${style.gradient} rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden text-white border-4 border-white/15`}>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full filter blur-2xl pointer-events-none" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="bg-white/20 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                          MÔN HỌC ĐANG CHỌN
                        </span>
                        <span className="text-xl">{style.emoji}</span>
                      </div>
                      
                      <h2 className="text-3xl sm:text-4xl font-sans font-black text-white tracking-tight leading-tight">
                        Chuyên Đề: {selectedSubject.name}
                      </h2>
                      <p className="text-xs sm:text-sm text-white/90 mt-2 max-w-xl font-bold leading-relaxed">
                        Bạn đã hoàn thành xong <span className="underline decoration-amber-300 decoration-2 font-black">{completed} trên tổng số {totalSets}</span> chủ đề từ vựng thuộc môn này hôm nay! 🔥
                      </p>
                    </div>

                    <div className="bg-slate-950/20 border border-white/10 p-4.5 rounded-2xl text-center min-w-[150px]">
                      <span className="text-[10px] text-white/70 font-black tracking-widest block mb-0.5 uppercase">TIẾN ĐỘ CHUNG</span>
                      <span className="text-3xl font-black text-white">
                        {totalSets > 0 ? Math.round((completed / totalSets) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* DAILY RANDOM WORDS PRACTICE BANNER - ONLY FOR ENGLISH SUBJECT */}
                {(selectedSubject.id === "subj_eng" || selectedSubject.name.toLowerCase().includes("tiếng anh")) && dailyWords.length > 0 && (
                  <div className="bg-slate-950 border-4 border-slate-900 rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(2,6,23,1)] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 my-2">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/5 rounded-full filter blur-3xl pointer-events-none" />
                    
                    <div className="space-y-3 max-w-2xl text-center md:text-left w-full">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                        <span className="bg-fuchsia-500 text-white text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg uppercase flex items-center gap-1 shadow-md">
                          <Sparkles className="h-3.5 w-3.5" /> BÀI TẬP DAILY CHUẨN
                        </span>
                        {isDailyCompleted ? (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">
                            🎉 ĐÃ PHÁ ĐẢO HÔM NAY!
                          </span>
                        ) : dailyCompletedCount > 0 ? (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">
                            ⚡ ĐANG HỌC: {dailyCompletedCount}/20 TỪ
                          </span>
                        ) : (
                          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">
                            🎯 CHƯA BẮT ĐẦU
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl sm:text-2xl font-sans font-black text-white tracking-tight leading-tight">
                        🎯 20 Từ Vựng Ngẫu Nhiên Hôm Nay
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        Hệ thống đã tự động lọc ngẫu nhiên đúng 20 từ vựng từ kho 2569 từ để luyện tập ngày hôm nay. 
                        Các từ này hoàn toàn không trùng lặp với hôm qua. Hoàn thành ngay để lưu chuỗi và bùng nổ streak!
                      </p>

                      {/* Progress bar */}
                      <div className="space-y-1 w-full max-w-md pt-1 mx-auto md:mx-0">
                        <div className="flex justify-between text-[10px] font-bold font-mono text-slate-500 uppercase">
                          <span>Tiến độ thuộc bài:</span>
                          <span>{Math.round((dailyCompletedCount / 20) * 100)}% ({dailyCompletedCount}/20 từ)</span>
                        </div>
                        <div className="w-full h-3 bg-slate-900 border-2 border-slate-850 rounded-full overflow-hidden p-0.5">
                          <div 
                            className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 rounded-full transition-all duration-500"
                            style={{ width: `${(dailyCompletedCount / 20) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 w-full md:w-auto shrink-0">
                      <button
                        onClick={() => {
                          const pseudoSet: VocabularySet = {
                            id: "daily_random_set",
                            subjectId: "daily_random",
                            title: "20 Từ Vựng Ngẫu Nhiên Hôm Nay",
                            description: "Bộ 20 từ vựng ngẫu nhiên được chọn từ kho 2569 từ, làm mới tự động lúc 00:00 ICT.",
                            words: dailyWords,
                            wordsCount: dailyWords.length
                          };
                          onSelectSet(pseudoSet);
                        }}
                        className={`w-full md:w-auto px-8 py-3.5 rounded-2xl font-black text-sm border-2 border-slate-950 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[4px_4px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 ${
                          isDailyCompleted
                            ? "bg-emerald-400 hover:bg-emerald-500 text-slate-950"
                            : "bg-yellow-300 hover:bg-yellow-400 text-slate-950"
                        }`}
                      >
                        {isDailyCompleted ? (
                          <>
                            <CheckCircle className="h-5 w-5" />
                            Luyện lại bài học 🎉
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Luyện tập ngay 🚀
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Vocabulary Sets Section Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <h3 className="font-sans font-black text-xl text-slate-900 flex items-center gap-2">
                    <BookMarked className="h-5 w-5 text-indigo-500" />
                    Các bộ từ vựng môn {selectedSubject.name} ({totalSets})
                  </h3>
                </div>

                {/* Grid of Vocabulary Sets under the selected Subject */}
                {filteredSets.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center text-slate-500 shadow-sm">
                    <BookMarked className="h-14 w-14 text-slate-300 mx-auto mb-4 animate-pulse" />
                    <p className="text-lg font-black text-slate-800">Môn này hiện chưa có bài học</p>
                    <p className="text-sm mt-1.5 text-slate-400 font-medium max-w-md mx-auto">
                      Quản trị viên đang biên soạn bộ từ vựng chất lượng cao cho môn học này. Quay lại sau nha học sinh thân mến! 💖
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSets.map((set) => {
                      const progress = todayProgress[set.id];
                      const isCompleted = progress?.isCompleted || false;
                      const completedWordsCount = progress?.completedWords?.length || 0;
                      const percent = progress?.completedPercent || 0;

                      return (
                        <div
                          key={set.id}
                          id={`vocab-set-card-${set.id}`}
                          className={`bg-white border-2 hover:border-slate-950 rounded-3xl p-6 flex flex-col justify-between shadow-md hover:shadow-xl transition-all duration-300 group cursor-pointer hover:-translate-y-1.5 relative overflow-hidden ${
                            isCompleted 
                              ? "border-emerald-500 bg-gradient-to-br from-white to-emerald-50/20" 
                              : "border-slate-200"
                          }`}
                          onClick={() => onSelectSet(set)}
                        >
                          {/* Completion ribbon top accent */}
                          {isCompleted && (
                            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-400 [clip-path:polygon(100%_0,0_0,100%_100%)] flex items-start justify-end p-1.5 text-white shadow-md">
                              <Star className="h-4 w-4 fill-white animate-spin [animation-duration:8s]" />
                            </div>
                          )}

                          <div>
                            {/* Card Header Status */}
                            <div className="flex items-center justify-between mb-4 pr-6">
                              <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded-full font-sans">
                                📚 {set.wordsCount} từ vựng
                              </span>

                              {isCompleted ? (
                                <span className="bg-emerald-100 border border-emerald-200 text-emerald-700 text-[9px] py-1 px-2.5 rounded-full font-black flex items-center gap-1 font-sans uppercase tracking-wider">
                                  <CheckCircle className="h-3 w-3 fill-emerald-500/10" /> HOÀN THÀNH
                                </span>
                              ) : percent > 0 ? (
                                <span className="bg-fuchsia-100 border border-fuchsia-200 text-fuchsia-700 text-[9px] py-1 px-2.5 rounded-full font-black font-sans uppercase tracking-wider animate-pulse">
                                  Đang học: {percent}%
                                </span>
                              ) : (
                                <span className="bg-slate-100 border border-slate-200 text-slate-500 text-[9px] py-1 px-2.5 rounded-full font-black font-sans uppercase tracking-wider">
                                  CHƯA HỌC
                                </span>
                              )}
                            </div>

                            {/* Set Information */}
                            <h3 className="font-sans font-black text-lg text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug mb-2 pr-4">
                              {set.title}
                            </h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-3 mb-6">
                              {set.description}
                            </p>
                          </div>

                          <div className="space-y-4">
                            {/* Subject progress bar inside the card */}
                            {percent > 0 && (
                              <div>
                                <div className="flex justify-between text-[10px] font-sans font-black text-slate-400 mb-1.5">
                                  <span>ĐÃ NHỚ: {completedWordsCount}/{set.wordsCount} từ</span>
                                  <span>{percent}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${isCompleted ? "bg-emerald-500" : "bg-fuchsia-500"}`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Vibrant CTA button */}
                            <button
                              className={`w-full py-3 px-4 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                                isCompleted
                                  ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/10"
                                  : "bg-slate-950 hover:bg-slate-900 text-white hover:scale-102 active:scale-98"
                              }`}
                            >
                              <span>{isCompleted ? "XEM LẠI TỪ VỰNG" : percent > 0 ? "TIẾP TỤC CHIẾN" : "BẮT ĐẦU CHIẾN NGAY"}</span>
                              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
