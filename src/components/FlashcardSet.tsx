import React, { useState, useEffect } from "react";
import { AppUser, VocabularySet, Progress, Word } from "../types";
import { subscribeToProgress, updateProgress } from "../services/flashcardService";
import { getVNDateString, getVNTimeUntilMidnight } from "../utils/timezone";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ChevronLeft,
  BookOpen,
  Award,
  Sparkles,
  RefreshCw,
  Eye
} from "lucide-react";

interface FlashcardSetProps {
  user: AppUser;
  vocabularySet: VocabularySet;
  onBack: () => void;
}

export default function FlashcardSet({ user, vocabularySet, onBack }: FlashcardSetProps) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [roundWords, setRoundWords] = useState<Word[]>([]);
  const [nextRoundWords, setNextRoundWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [useInstantFlip, setUseInstantFlip] = useState(false);
  const [todayStr] = useState(() => getVNDateString());
  const [showCelebration, setShowCelebration] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(() => getVNTimeUntilMidnight());

  const currentWord = roundWords[currentIndex];

  // Reset flipped state immediately and seamlessly on card change
  useEffect(() => {
    if (currentWord) {
      setIsFlipped(false);
      const timer = setTimeout(() => {
        setUseInstantFlip(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [currentWord?.id]);

  // Countdown clock until midnight (Vietnam time)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(getVNTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to study progress for today in real-time
  useEffect(() => {
    setLoadingProgress(true);
    const unsubscribe = subscribeToProgress(user.uid, vocabularySet.subjectId, vocabularySet.id, todayStr, (prog) => {
      setProgress(prog);
      setLoadingProgress(false);

      if (prog) {
        // If the set was completed, trigger celebration
        if (prog.isCompleted) {
          setShowCelebration(true);
          setRoundWords([]);
          setNextRoundWords([]);
        } else {
          // Filter vocabulary words to find those not yet completed
          const remainingWords = vocabularySet.words.filter(
            (word) => !prog.completedWords.includes(word.id)
          );
          
          setRoundWords((prev) => {
            if (prev.length === 0) {
              return remainingWords;
            }
            // Keep existing round words but filter out any that became completed
            const updated = prev.filter(w => !prog.completedWords.includes(w.id));
            if (updated.length === 0 && remainingWords.length > 0) {
              return remainingWords;
            }
            return updated;
          });

          setNextRoundWords((prev) => prev.filter(w => !prog.completedWords.includes(w.id)));
        }
      } else {
        // No progress for today yet, fill queue with all words
        setRoundWords(vocabularySet.words);
        setNextRoundWords([]);
        setCurrentIndex(0);
        setShowCelebration(false);
      }
    });

    return () => unsubscribe();
  }, [user.uid, vocabularySet.id, todayStr]);

  // Adjust current index if it goes out of bounds
  useEffect(() => {
    if (roundWords.length > 0 && currentIndex >= roundWords.length) {
      setCurrentIndex(Math.max(0, roundWords.length - 1));
    }
  }, [roundWords, currentIndex]);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  // Mark card as "Đã nhớ" (Remembered)
  const handleRemembered = async () => {
    if (!currentWord) return;

    setUseInstantFlip(true);
    setIsFlipped(false);
    
    // Add to completed words list
    const currentCompleted = progress ? [...progress.completedWords] : [];
    if (!currentCompleted.includes(currentWord.id)) {
      currentCompleted.push(currentWord.id);
    }

    // Remove from incorrect words if it was there in progress
    const currentIncorrect = progress ? [...progress.incorrectWords] : [];
    const updatedIncorrect = currentIncorrect.filter((id) => id !== currentWord.id);

    // Filter out from our local review states immediately for maximum responsiveness!
    const filteredNextRound = nextRoundWords.filter((w) => w.id !== currentWord.id);
    const filteredRound = roundWords.filter((w) => w.id !== currentWord.id);

    // Save to Firestore in background
    await updateProgress(
      user.uid,
      user.displayName,
      user.email,
      user.groupIds || (user.groupId ? [user.groupId] : []),
      vocabularySet.subjectId,
      vocabularySet.id,
      todayStr,
      currentCompleted,
      updatedIncorrect,
      vocabularySet.wordsCount
    );

    // Round progression logic:
    if (filteredRound.length === 0) {
      // Current round is finished! Do we have any unremembered words for the next round?
      if (filteredNextRound.length > 0) {
        setRoundWords(filteredNextRound);
        setNextRoundWords([]);
        setCurrentIndex(0);
      } else {
        // No unremembered words! If all words in the set are completed, celebrate!
        if (currentCompleted.length >= vocabularySet.wordsCount) {
          setShowCelebration(true);
        } else {
          // If some other words are not yet completed (e.g. added later), load them
          const remainingNotCompleted = vocabularySet.words.filter(w => !currentCompleted.includes(w.id));
          setRoundWords(remainingNotCompleted);
          setNextRoundWords([]);
          setCurrentIndex(0);
        }
      }
    } else {
      // Round is not finished.
      // Since currentWord is removed, filteredRound is smaller.
      // The word at currentIndex is now the next word in filteredRound.
      // If the index is out of bounds, wrap it to 0.
      setRoundWords(filteredRound);
      setNextRoundWords(filteredNextRound);
      if (currentIndex >= filteredRound.length) {
        setCurrentIndex(0);
      }
    }
  };

  // Mark card as "Chưa nhớ" (Forgotten)
  const handleNotRemembered = async () => {
    if (!currentWord) return;

    setUseInstantFlip(true);
    setIsFlipped(false);

    // Save to Firestore incorrectWords
    const currentCompleted = progress ? [...progress.completedWords] : [];
    const currentIncorrect = progress ? [...progress.incorrectWords] : [];
    if (!currentIncorrect.includes(currentWord.id)) {
      currentIncorrect.push(currentWord.id);
    }

    // Keep track of unremembered words for the next review round
    const updatedNextRound = [...nextRoundWords];
    if (!updatedNextRound.some(w => w.id === currentWord.id)) {
      updatedNextRound.push(currentWord);
    }

    await updateProgress(
      user.uid,
      user.displayName,
      user.email,
      user.groupIds || (user.groupId ? [user.groupId] : []),
      vocabularySet.subjectId,
      vocabularySet.id,
      todayStr,
      currentCompleted,
      currentIncorrect,
      vocabularySet.wordsCount
    );

    // Move to the next word in the current round
    const isLastInRound = currentIndex >= roundWords.length - 1;
    if (isLastInRound) {
      // Round is finished! Cycle to the unremembered words.
      setRoundWords(updatedNextRound);
      setNextRoundWords([]);
      setCurrentIndex(0);
    } else {
      // Just advance index to the next word
      setNextRoundWords(updatedNextRound);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Reset progress to learn again
  const handleResetProgress = async () => {
    if (window.confirm("Bạn có chắc chắn muốn reset lại tiến trình học của bộ này hôm nay để học lại từ đầu?")) {
      setIsFlipped(false);
      setShowCelebration(false);
      setCurrentIndex(0);
      await updateProgress(
        user.uid,
        user.displayName,
        user.email,
        user.groupIds || (user.groupId ? [user.groupId] : []),
        vocabularySet.subjectId,
        vocabularySet.id,
        todayStr,
        [],
        [],
        vocabularySet.wordsCount
      );
    }
  };

  if (loadingProgress) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-800">
        <div className="relative w-16 h-16 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-pink-200 border-t-pink-600 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-4 border-yellow-100 border-t-yellow-500 animate-spin [animation-duration:1.2s]"></div>
        </div>
        <p className="text-sm font-sans font-black tracking-widest text-slate-700 uppercase animate-bounce">
          ĐANG TẢI TIẾN TRÌNH... ✨
        </p>
      </div>
    );
  }

  // Calculate stats
  const totalCount = vocabularySet.wordsCount;
  const completedCount = progress ? progress.completedWords.length : 0;
  const percent = progress ? progress.completedPercent : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 relative">
      {/* Back Button and Session Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 bg-white/80 hover:bg-slate-950 hover:text-white border-3 border-slate-950 px-4 py-2 rounded-2xl text-slate-950 text-sm font-black transition-all shadow-[3px_3px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 cursor-pointer"
          id="btn-back-to-sets"
        >
          <ChevronLeft className="h-4 w-4 stroke-[3]" /> Trở lại bộ từ vựng
        </button>

        <div className="inline-flex items-center gap-2 bg-pink-100 border-3 border-slate-950 px-4 py-2 rounded-2xl text-slate-950 text-xs font-black shadow-[3px_3px_0px_0px_rgba(2,6,23,1)]">
          <Clock className="h-4 w-4 text-pink-600 animate-pulse" />
          <span>Reset sau: {String(timeRemaining.hours).padStart(2, "0")}:{String(timeRemaining.minutes).padStart(2, "0")}:{String(timeRemaining.seconds).padStart(2, "0")}</span>
        </div>
      </div>

      {/* Set Details Card */}
      <div className="bg-gradient-to-r from-violet-100 via-pink-100 to-amber-100 border-4 border-slate-950 p-6 rounded-3xl mb-8 shadow-[6px_6px_0px_0px_rgba(2,6,23,1)]">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 bg-slate-950 rounded-xl text-yellow-300">
            <BookOpen className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-black text-slate-950 tracking-tight">{vocabularySet.title}</h2>
        </div>
        <p className="text-sm text-slate-800 font-bold leading-relaxed">{vocabularySet.description}</p>
      </div>

      {/* Progress Bar Container with Neobrutalist design */}
      <div className="bg-white border-4 border-slate-950 rounded-3xl p-5 mb-8 shadow-[6px_6px_0px_0px_rgba(2,6,23,1)]">
        <div className="flex items-center justify-between mb-3 text-sm">
          <span className="text-slate-700 font-black flex items-center gap-1.5">
            🎯 Hôm Nay Bạn Đã Học:
          </span>
          <span className="bg-emerald-100 text-slate-950 border-2 border-slate-950 px-3 py-1 rounded-xl text-xs font-black">
            {completedCount}/{totalCount} từ ({percent}%)
          </span>
        </div>
        <div className="h-5 w-full bg-slate-100 rounded-full overflow-hidden border-3 border-slate-950 p-0.5">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 rounded-full border-r-2 border-slate-950"
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Render Study UI or Celebration Screen */}
      <AnimatePresence mode="wait">
        {showCelebration || percent === 100 ? (
          <motion.div
            key="celebration"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-br from-indigo-50 via-rose-50 to-amber-50 border-4 border-slate-950 rounded-3xl p-8 text-center shadow-[8px_8px_0px_0px_rgba(2,6,23,1)] relative overflow-hidden"
          >
            {/* Background sparkle effects */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-yellow-100/30 to-transparent pointer-events-none" />

            <div className="inline-flex p-5 bg-yellow-300 border-4 border-slate-950 text-slate-950 rounded-full mb-5 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)] transform hover:rotate-12 transition-transform cursor-pointer">
              <Award className="h-14 w-14" />
            </div>

            <h3 className="text-3xl font-black text-slate-950 mb-3 tracking-tight">🎉 XUẤT SẮC! HOÀN THÀNH 100% 🎉</h3>
            <p className="text-slate-800 font-bold text-sm max-w-md mx-auto mb-6 leading-relaxed">
              Bạn đã thuộc lòng toàn bộ <strong>{totalCount}</strong> từ vựng của chủ đề này hôm nay. Kết quả đã đồng bộ thời gian thực lên hệ thống nhóm để tích lũy chuỗi streak!
            </p>

            {user.groupId ? (
              <div className="bg-emerald-50 border-3 border-slate-950 rounded-2xl p-5 max-w-md mx-auto mb-8 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]">
                <p className="text-xs text-emerald-700 font-black font-sans uppercase tracking-wider mb-1.5 flex items-center justify-center gap-1">
                  <span>🚀</span> ĐỒNG BỘ STREAK NHÓM THÀNH CÔNG
                </p>
                <p className="text-xs sm:text-sm text-slate-800 font-bold leading-relaxed">Kết quả của bạn đã cập nhật lên bảng tin. Hãy nhắc nhở các thành viên khác học bài để giữ chuỗi streak nhóm nhé!</p>
              </div>
            ) : (
              <div className="bg-amber-50 border-3 border-slate-950 rounded-2xl p-5 max-w-md mx-auto mb-8 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]">
                <p className="text-xs text-amber-700 font-black font-sans uppercase tracking-wider mb-1.5 flex items-center justify-center gap-1">
                  <span>💡</span> MẸO GIỮ CHUỖI CÙNG ĐỒNG ĐỘI
                </p>
                <p className="text-xs sm:text-sm text-slate-800 font-bold leading-relaxed">Hãy tạo hoặc tham gia một nhóm giữ chuỗi để học tập cùng bạn bè và rèn luyện thói quen học từ vựng mỗi ngày!</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleResetProgress}
                className="w-full sm:w-auto bg-white hover:bg-slate-100 border-3 border-slate-950 text-slate-950 text-sm py-3 px-6 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 stroke-[3]" /> Học lại từ đầu
              </button>
              <button
                onClick={onBack}
                className="w-full sm:w-auto bg-yellow-300 hover:bg-yellow-400 border-3 border-slate-950 text-slate-950 text-sm py-3 px-6 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" /> Chọn chủ đề khác
              </button>
            </div>
          </motion.div>
        ) : roundWords.length > 0 && currentWord ? (
          <motion.div key="learning-panel" exit={{ opacity: 0 }}>
            {/* Flashcard container */}
            <div className="h-80 w-full perspective-1000 mb-8 cursor-pointer" onClick={handleFlip}>
              <motion.div
                className="relative h-full w-full rounded-3xl preserve-3d"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: useInstantFlip ? 0 : 0.4, ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d" }}
              >
                {/* Front Side */}
                <div
                  className="absolute inset-0 h-full w-full rounded-3xl bg-white border-4 border-slate-950 p-8 flex flex-col justify-between shadow-[8px_8px_0px_0px_rgba(2,6,23,1)]"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <div className="flex justify-between items-center text-xs font-black text-slate-500">
                    <span className="flex items-center gap-1">🇺🇸 TIẾNG ANH</span>
                    <span className="bg-slate-100 border-2 border-slate-950 px-2.5 py-1 rounded-xl text-slate-950">
                      Từ {currentIndex + 1} / {roundWords.length}
                    </span>
                  </div>

                  <div className="text-center my-auto">
                    <h4 className="text-4xl sm:text-5xl font-sans font-black text-slate-950 tracking-tight mb-3">
                      {currentWord.english}
                    </h4>
                    {currentWord.phonetic && (
                      <span className="inline-block px-3.5 py-1.5 bg-violet-100 border-2 border-slate-950 text-violet-900 rounded-xl font-mono text-sm font-bold shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                        {currentWord.phonetic}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-center items-center text-xs font-black text-pink-600 gap-1.5 animate-pulse">
                    <Eye className="h-4.5 w-4.5 text-pink-600" /> CHẠM VÀO THẺ ĐỂ XEM NGHĨA TIẾNG VIỆT
                  </div>
                </div>

                {/* Back Side */}
                <div
                  className="absolute inset-0 h-full w-full rounded-3xl bg-gradient-to-tr from-slate-950 to-indigo-950 border-4 border-slate-950 p-8 flex flex-col justify-between shadow-[8px_8px_0px_0px_rgba(2,6,23,1)]"
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                >
                  <div className="flex justify-between items-center text-xs font-black text-indigo-300">
                    <span className="flex items-center gap-1">🇻🇳 TIẾNG VIỆT</span>
                    <span className="bg-indigo-900/80 border-2 border-indigo-700 px-2.5 py-1 rounded-xl text-white">
                      Từ {currentIndex + 1} / {roundWords.length}
                    </span>
                  </div>

                  <div className="text-center my-auto px-2">
                    <span className="text-[10px] bg-amber-400 text-slate-950 border-2 border-slate-950 font-black py-1 px-3 rounded-full mb-3 inline-block uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                      Định nghĩa
                    </span>
                    <h4 className="text-2xl sm:text-3xl font-sans font-black text-white tracking-tight mb-4 drop-shadow-md">
                      {currentWord.vietnamese}
                    </h4>

                    {currentWord.example && (
                      <div className="bg-indigo-900/40 p-4 rounded-2xl border-2 border-indigo-800 max-w-md mx-auto text-left shadow-inner space-y-1">
                        <p className="text-[10px] text-amber-300 mb-0.5 font-black tracking-wider uppercase">Ví dụ minh họa:</p>
                        <p className="text-xs sm:text-sm text-indigo-100 italic font-medium leading-relaxed">"{currentWord.example}"</p>
                        {currentWord.exampleTranslate && (
                          <p className="text-[11px] text-indigo-300 font-bold leading-relaxed border-t border-indigo-800/40 pt-1">
                            {currentWord.exampleTranslate}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center items-center text-xs font-black text-indigo-300 gap-1.5">
                    CHẠM LẦN NỮA ĐỂ QUAY VỀ MẶT TRƯỚC
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Answer Controls with Playful, bouncy buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNotRemembered();
                }}
                className="group bg-white hover:bg-rose-100 text-slate-950 border-4 border-slate-950 py-4 px-6 rounded-2xl font-black shadow-[4px_4px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 flex items-center justify-center gap-3 transition-all cursor-pointer"
                id="btn-not-remembered"
              >
                <XCircle className="h-6 w-6 text-rose-500 stroke-[3] group-hover:scale-110 transition-transform" />
                <div className="text-left leading-tight">
                  <p className="text-sm font-black text-slate-950">Chưa nhớ 😭</p>
                  <p className="text-[10px] text-slate-500 font-bold">Luyện lại sau</p>
                </div>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemembered();
                }}
                className="group bg-emerald-300 hover:bg-emerald-400 text-slate-950 border-4 border-slate-950 py-4 px-6 rounded-2xl font-black shadow-[4px_4px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 flex items-center justify-center gap-3 transition-all cursor-pointer"
                id="btn-remembered"
              >
                <CheckCircle2 className="h-6 w-6 text-slate-950 stroke-[3] group-hover:scale-110 transition-transform" />
                <div className="text-left leading-tight">
                  <p className="text-sm font-black text-slate-950">Đã thuộc! 😎</p>
                  <p className="text-[10px] text-slate-800 font-bold">Vượt qua</p>
                </div>
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="bg-white border-4 border-slate-950 rounded-3xl p-8 text-center shadow-[6px_6px_0px_0px_rgba(2,6,23,1)] text-slate-500">
            <HelpCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-sans font-black text-slate-800 uppercase tracking-wide">Bộ từ vựng này hiện chưa có từ nào để học.</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
