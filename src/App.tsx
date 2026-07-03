import React, { useState, useEffect } from "react";
import { AppUser, VocabularySet, CommunitySettings } from "./types";
import { subscribeToAuthAndProfile, signUpUser, loginUser } from "./services/authService";
import { subscribeToCommunitySettings } from "./services/communityService";
import { seedVocabularySetsIfNeeded } from "./utils/seed";
import Navbar from "./components/Navbar";
import VocabularyList from "./components/VocabularyList";
import FlashcardSet from "./components/FlashcardSet";
import GroupStreak from "./components/GroupStreak";
import Community from "./components/Community";
import AdminDashboard from "./components/AdminDashboard";
import UserProfile from "./components/UserProfile";
import { Sparkles, Mail, Lock, User, Shield, RefreshCw } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("learn");
  const [selectedSet, setSelectedSet] = useState<VocabularySet | null>(null);
  const [communitySettings, setCommunitySettings] = useState<CommunitySettings | null>(null);

  // Authentication & SignUp Form states
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Listen to real-time community settings
  useEffect(() => {
    const unsubscribe = subscribeToCommunitySettings((settings) => {
      setCommunitySettings(settings);
    });
    return () => unsubscribe();
  }, []);

  // Establish real-time Auth & Profile state subscriber
  useEffect(() => {
    const unsubscribe = subscribeToAuthAndProfile((appUser, isLoading) => {
      setUser(appUser);
      setLoading(isLoading);

      // Trigger automatic seeding of default sets if logged in
      if (appUser) {
        seedVocabularySetsIfNeeded();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!email.trim() || !password.trim()) {
      setAuthError("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    if (isRegisterMode && !displayName.trim()) {
      setAuthError("Vui lòng nhập tên hiển thị.");
      return;
    }

    setAuthLoading(true);
    try {
      if (isRegisterMode) {
        await signUpUser(email.trim(), password.trim(), displayName.trim());
      } else {
        await loginUser(email.trim(), password.trim());
      }
    } catch (error: any) {
      console.error("Lỗi xác thực:", error);
      let errorMsg = "Xác thực không thành công. Vui lòng kiểm tra lại!";
      if (error.code === "auth/email-already-in-use") {
        errorMsg = "Địa chỉ email này đã được đăng ký tài khoản khác.";
      } else if (error.code === "auth/weak-password") {
        errorMsg = "Mật khẩu quá ngắn (tối thiểu cần 6 ký tự).";
      } else if (error.code === "auth/invalid-credential") {
        errorMsg = "Email hoặc mật khẩu không chính xác. Vui lòng thử lại!";
      } else if (error.message) {
        errorMsg = error.message;
      }
      setAuthError(errorMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleToggleAuthMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setAuthError("");
    setEmail("");
    setPassword("");
    setDisplayName("");
  };

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-tr from-amber-500 via-pink-500 to-indigo-600 flex flex-col items-center justify-center text-white">
        <div className="relative w-14 h-14 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-white/20 border-t-white animate-spin"></div>
          <div className="absolute inset-1.5 rounded-full border-4 border-yellow-300/20 border-t-yellow-300 animate-spin [animation-duration:1.5s]"></div>
        </div>
        <p className="text-sm font-sans font-black tracking-widest animate-pulse">
          ĐANG KHỞI ĐỘNG GROUPSTREAK... 🚀
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-amber-50/60 via-rose-50/60 to-violet-100/50 text-slate-900 flex flex-col justify-between relative overflow-hidden selection:bg-pink-500/20">
      {/* Dynamic Floating Ambient Blobs for GenZ Aesthetic */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-pink-400/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-40 right-10 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none animate-bounce [animation-duration:12s]" />
      <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-amber-400/10 rounded-full blur-3xl pointer-events-none animate-pulse [animation-duration:8s]" />

      {/* 1. AUTHENTICATED USER WORKSPACE */}
      {user ? (
        <div className="flex flex-col min-h-screen relative z-10">
          <Navbar 
            user={user} 
            activeTab={activeTab} 
            communitySettings={communitySettings}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              // Clear current selected set when moving away
              setSelectedSet(null);
            }} 
          />

          <main className="flex-grow pb-16">
            {activeTab === "learn" && (
              selectedSet ? (
                <FlashcardSet
                  user={user}
                  vocabularySet={selectedSet}
                  onBack={() => setSelectedSet(null)}
                />
              ) : (
                <VocabularyList
                  user={user}
                  onSelectSet={setSelectedSet}
                />
              )
            )}

            {activeTab === "group" && (
              <GroupStreak user={user} />
            )}

            {activeTab === "community" && (
              <Community user={user} communitySettings={communitySettings} />
            )}

            {activeTab === "profile" && (
              <UserProfile user={user} />
            )}

            {activeTab === "admin" && user.role === "admin" && (
              <AdminDashboard user={user} communitySettings={communitySettings} />
            )}
          </main>

          {/* Footer */}
          <footer className="bg-white/60 border-t border-slate-200/80 backdrop-blur-md py-6 text-center text-xs text-slate-500 font-sans font-medium">
            <p>© 2026 GroupStreak Applet. All rights reserved.</p>
            <p className="mt-1 text-slate-400">Real-time learning stats powered securely by Google Cloud Firestore</p>
          </footer>
        </div>
      ) : (
        /* 2. NON-AUTHENTICATED PORTAL (LOGIN / SIGNUP) */
        <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden bg-gradient-to-tr from-amber-200 via-rose-300 to-indigo-400">
          {/* Neon background light enhancements */}
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-300/30 rounded-full filter blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-yellow-300/30 rounded-full filter blur-3xl pointer-events-none" />

          <div className="max-w-md w-full relative z-10">
            {/* Header / Brand */}
            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-slate-950 text-white rounded-3xl shadow-2xl mb-4 transform hover:scale-110 hover:rotate-6 transition-all duration-300">
                <Sparkles className="h-9 w-9 text-yellow-300 animate-spin [animation-duration:10s]" />
              </div>
              <h1 className="text-4xl font-sans font-black text-slate-950 tracking-tight drop-shadow-md">
                GroupStreak 🚀
              </h1>
              <p className="text-xs sm:text-sm text-slate-900 font-bold mt-2 max-w-sm mx-auto leading-relaxed">
                Đồng hành giữ chuỗi học tập hàng ngày - Đột phá 100% phản xạ từ vựng cùng đồng đội! 🦄
              </p>
            </div>

            {/* Auth Card with extra rounded borders and heavy shadow */}
            <div className="bg-white/90 backdrop-blur-xl border-4 border-slate-950 rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(2,6,23,1)] relative">
              <h2 className="text-xl font-black text-slate-950 mb-6 font-sans flex items-center gap-2">
                <span className="text-2xl">{isRegisterMode ? "✨" : "🔑"}</span>
                {isRegisterMode ? "Đăng Ký Tài Khoản Mới" : "Đăng Nhập Học Ngay!"}
              </h2>

              {authError && (
                <div className="mb-5 bg-rose-50 border-2 border-rose-500 text-rose-700 p-4 rounded-xl text-xs font-bold leading-relaxed">
                  ⚠️ {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {isRegisterMode && (
                  <div>
                    <label className="block text-[10px] font-sans font-black tracking-wider text-slate-700 uppercase mb-1.5">
                      Họ và Tên Của Bạn:
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Nguyễn Văn A"
                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-slate-950 text-slate-900 text-sm font-bold rounded-xl py-3 pl-11 pr-4 focus:outline-none transition-all focus:bg-white"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-sans font-black tracking-wider text-slate-700 uppercase mb-1.5">
                    Địa chỉ Email:
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ten@hocsinh.com"
                      className="w-full bg-slate-50 border-2 border-slate-200 focus:border-slate-950 text-slate-900 text-sm font-bold rounded-xl py-3 pl-11 pr-4 focus:outline-none transition-all focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-sans font-black tracking-wider text-slate-700 uppercase mb-1.5">
                    Mật khẩu bảo mật:
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border-2 border-slate-200 focus:border-slate-950 text-slate-900 text-sm font-bold rounded-xl py-3 pl-11 pr-4 focus:outline-none transition-all focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-slate-950 hover:bg-slate-900 disabled:bg-slate-800 text-white text-sm font-black py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:scale-102 active:scale-98"
                  id="btn-auth-submit"
                >
                  {authLoading ? (
                    <RefreshCw className="h-4.5 w-4.5 animate-spin text-white" />
                  ) : isRegisterMode ? (
                    "TẠO TÀI KHOẢN NGAY ✨"
                  ) : (
                    "VÀO LỚP HỌC NGAY 🚀"
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-200 text-center text-xs">
                <p className="text-slate-500 font-bold">
                  {isRegisterMode ? "Đã có tài khoản ôn tập?" : "Chưa có tài khoản?"}{" "}
                  <button
                    onClick={handleToggleAuthMode}
                    className="text-pink-600 hover:text-pink-700 font-black underline transition-colors cursor-pointer"
                  >
                    {isRegisterMode ? "Đăng nhập tại đây" : "Đăng ký thành viên mới!"}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

