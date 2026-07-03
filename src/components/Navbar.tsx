import React from "react";
import { AppUser, CommunitySettings } from "../types";
import { logoutUser } from "../services/authService";
import { BookOpen, Users, MessageSquare, Shield, LogOut, ExternalLink, Sparkles, User } from "lucide-react";

interface NavbarProps {
  user: AppUser;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  communitySettings?: CommunitySettings | null;
}

export default function Navbar({ user, activeTab, setActiveTab, communitySettings }: NavbarProps) {
  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  const navItems = [
    { id: "learn", label: "Học Tập", icon: BookOpen },
    { id: "group", label: "Giữ Chuỗi Nhóm", icon: Users },
    { id: "community", label: "Cộng Đồng Chat", icon: MessageSquare },
    { id: "profile", label: "Hồ Sơ", icon: User },
  ];

  if (user.role === "admin") {
    navItems.push({ id: "admin", label: "Quản Trị Viên", icon: Shield });
  }

  return (
    <header className="bg-white/80 backdrop-blur-md border-b-4 border-slate-950 text-slate-900 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand/Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer transform hover:scale-105 transition-transform" onClick={() => setActiveTab("learn")}>
            <div className="bg-slate-950 p-2.5 rounded-2xl text-yellow-300 shadow-[3px_3px_0px_0px_rgba(2,6,23,1)]">
              <Sparkles className="h-5.5 w-5.5" id="logo-icon" />
            </div>
            <div>
              <h1 className="font-sans font-black text-xl leading-tight tracking-tight text-slate-950 hidden sm:block">
                GroupStreak 🚀
              </h1>
              <p className="text-[9px] text-slate-700 font-black tracking-widest hidden sm:block uppercase">Flashcards & Streaks</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 bg-slate-100/90 border-2 border-slate-950 p-1 rounded-2xl my-2 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-black rounded-xl transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-700 hover:text-slate-950 hover:bg-white"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div 
              onClick={() => setActiveTab("profile")} 
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity"
              title="Xem hồ sơ cá nhân"
            >
              {user.avatarUrl ? (
                <img 
                  src={user.avatarUrl} 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-full border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)] object-cover bg-white" 
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-200 border-2 border-slate-950 flex items-center justify-center font-black text-slate-950 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : "?"}
                </div>
              )}
              
              <div className="hidden lg:flex flex-col items-start leading-none gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-slate-950">{user.displayName}</span>
                  {user.role === "admin" && (
                    <span className="bg-rose-300 text-slate-950 text-[8px] px-1.5 py-0.5 rounded-md font-black border border-slate-950 shadow-[1px_1px_0px_0px_rgba(2,6,23,1)]">
                      ADMIN
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-bold">{user.username ? `@${user.username}` : user.email}</span>
              </div>
            </div>

            {/* Zalo / Discord Community Quick-link */}
            {(communitySettings?.zaloUrl || "https://zalo.me/g/community") && (
              <a
                href={communitySettings?.zaloUrl || "https://zalo.me/g/community"}
                target="_blank"
                referrerPolicy="no-referrer"
                className="bg-cyan-300 hover:bg-cyan-400 border-2 border-slate-950 text-slate-950 text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all font-black shadow-[2px_2px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 cursor-pointer"
                title={communitySettings?.zaloTitle || "Cộng Đồng Zalo"}
              >
                <ExternalLink className="h-3.5 w-3.5 stroke-[3]" />
                <span className="hidden sm:inline">{communitySettings?.zaloTitle || "Cộng Đồng Zalo"}</span>
              </a>
            )}

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="p-2 border-2 border-transparent hover:border-slate-950 hover:bg-rose-100 rounded-xl transition-all cursor-pointer text-slate-500 hover:text-rose-600"
              title="Đăng xuất"
              id="logout-btn"
            >
              <LogOut className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
