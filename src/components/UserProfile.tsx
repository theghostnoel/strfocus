import React, { useState, useRef, useEffect } from "react";
import { AppUser } from "../types";
import { 
  updateUserProfile, 
  changeUserPassword, 
  isUsernameTaken, 
  searchUserByUsername, 
  addFriend, 
  removeFriend, 
  getUsersByUids 
} from "../services/authService";
import { 
  User, 
  Key, 
  Upload, 
  Camera, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Heart,
  Users,
  Search,
  UserPlus,
  UserMinus
} from "lucide-react";
import { motion } from "motion/react";

interface UserProfileProps {
  user: AppUser;
}

export default function UserProfile({ user }: UserProfileProps) {
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [username, setUsername] = useState(user.username || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarUrl || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Friends & Social states
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendsList, setFriendsList] = useState<AppUser[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [friendActionError, setFriendActionError] = useState("");
  const [friendActionSuccess, setFriendActionSuccess] = useState("");

  // Loading & statuses
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if user prop changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setUsername(user.username || "");
      setAvatarPreview(user.avatarUrl || null);
    }
  }, [user]);

  // Fetch real-time friends details
  useEffect(() => {
    const fetchFriends = async () => {
      if (user.friends && user.friends.length > 0) {
        setIsLoadingFriends(true);
        try {
          const profiles = await getUsersByUids(user.friends);
          setFriendsList(profiles);
        } catch (err) {
          console.error("Error fetching friends:", err);
        } finally {
          setIsLoadingFriends(false);
        }
      } else {
        setFriendsList([]);
      }
    };
    fetchFriends();
  }, [user.friends]);

  // Compress and resize image using HTML5 canvas
  const compressAndResizeImage = (file: File, maxWidth = 300, maxHeight = 300, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Maintain aspect ratio
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Không thể khởi tạo Canvas 2D"));
            return;
          }

          // Render image onto canvas
          ctx.drawImage(img, 0, 0, width, height);
          
          // Get compressed base64 data URL
          const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(compressedDataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileError("Vui lòng chọn tệp tin hình ảnh hợp lệ (jpg, png, webp, ...)");
      return;
    }

    try {
      setProfileError("");
      // Automatically compress and resize instantly on selection
      const compressedBase64 = await compressAndResizeImage(file);
      setAvatarPreview(compressedBase64);
      setAvatarFile(file);
    } catch (err) {
      console.error(err);
      setProfileError("Không thể xử lý hình ảnh này. Thử lại tệp khác.");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess("");
    setProfileError("");
    setIsUpdatingProfile(true);

    if (!displayName.trim()) {
      setProfileError("Tên hiển thị không được để trống!");
      setIsUpdatingProfile(false);
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername) {
      // Validate handle
      const usernameRegex = /^[a-z0-9_]{3,15}$/;
      if (!usernameRegex.test(cleanUsername)) {
        setProfileError("Username chỉ được chứa chữ cái viết thường (a-z), chữ số (0-9) và dấu gạch dưới (_). Độ dài từ 3-15 ký tự.");
        setIsUpdatingProfile(false);
        return;
      }

      // Check uniqueness
      try {
        const taken = await isUsernameTaken(cleanUsername, user.uid);
        if (taken) {
          setProfileError("Username này đã có người sử dụng. Hãy chọn tên khác!");
          setIsUpdatingProfile(false);
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    try {
      const avatarUrlToSave = avatarPreview || undefined;
      await updateUserProfile(user.uid, displayName, avatarUrlToSave, cleanUsername || undefined);
      setProfileSuccess("Cập nhật thông tin tài khoản thành công!");
      
      // Auto-dismiss success message
      setTimeout(() => {
        setProfileSuccess("");
      }, 3500);
    } catch (err: any) {
      console.error(err);
      setProfileError(err.message || "Đã xảy ra lỗi khi cập nhật thông tin.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess("");
    setPasswordError("");
    setIsUpdatingPassword(true);

    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu mới phải có ít nhất 6 ký tự!");
      setIsUpdatingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không trùng khớp!");
      setIsUpdatingPassword(false);
      return;
    }

    try {
      await changeUserPassword(user.uid, newPassword);
      setPasswordSuccess("Đổi mật khẩu thành công!");
      setNewPassword("");
      setConfirmPassword("");

      // Auto-dismiss success message
      setTimeout(() => {
        setPasswordSuccess("");
      }, 3500);
    } catch (err: any) {
      console.error(err);
      setPasswordError(err.message || "Đã xảy ra lỗi khi thay đổi mật khẩu.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSearchFriends = async (e: React.FormEvent) => {
    e.preventDefault();
    setFriendActionError("");
    setFriendActionSuccess("");
    if (!friendSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchUserByUsername(friendSearchQuery);
      // Filter out self
      const filteredResults = results.filter(r => r.uid !== user.uid);
      setSearchResults(filteredResults);
      if (filteredResults.length === 0) {
        setFriendActionError("Không tìm thấy học viên nào khớp với username này.");
      }
    } catch (err) {
      console.error(err);
      setFriendActionError("Có lỗi xảy ra khi tìm kiếm.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriendAction = async (friendUid: string) => {
    setFriendActionError("");
    setFriendActionSuccess("");
    try {
      await addFriend(user.uid, friendUid);
      setFriendActionSuccess("Kết bạn thành công! 💖");
      // Remove from search candidates
      setSearchResults(prev => prev.filter(r => r.uid !== friendUid));
      setTimeout(() => setFriendActionSuccess(""), 3000);
    } catch (err: any) {
      setFriendActionError(err.message || "Không thể thêm bạn bè.");
    }
  };

  const handleRemoveFriendAction = async (friendUid: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy kết bạn với thành viên này?")) return;
    setFriendActionError("");
    setFriendActionSuccess("");
    try {
      await removeFriend(user.uid, friendUid);
      setFriendActionSuccess("Đã hủy kết bạn thành công!");
      setTimeout(() => setFriendActionSuccess(""), 3000);
    } catch (err: any) {
      setFriendActionError(err.message || "Không thể hủy kết bạn.");
    }
  };

  return (
    <div className="max-w-[95%] xl:max-w-[92%] 2xl:max-w-[1550px] mx-auto px-4 sm:px-6 py-8">
      {/* Header Banner - Neo Brutalism styling */}
      <div className="bg-yellow-300 border-4 border-slate-950 rounded-3xl p-6 sm:p-8 mb-8 shadow-[5px_5px_0px_0px_rgba(2,6,23,1)] relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-400/20 rounded-full filter blur-xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="bg-slate-950 text-yellow-300 text-[10px] px-3 py-1 rounded-xl font-black tracking-widest uppercase border-2 border-slate-950 shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)]">
              CÁ NHÂN HÓA HỒ SƠ 👤
            </span>
            <span className="bg-white text-slate-950 text-[10px] px-3 py-1 rounded-xl font-black tracking-widest uppercase border-2 border-slate-950 shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)] flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 fill-indigo-600" /> THÔNG TIN & BẠN BÈ
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-sans font-black text-slate-950 tracking-tight leading-none uppercase">
            Hồ Sơ Thành Viên 🚀
          </h2>
          <p className="text-sm text-slate-900 mt-2 max-w-2xl font-bold leading-relaxed">
            Thiết lập ảnh đại diện, đổi mật khẩu và cập nhật username của bạn để bạn bè có thể dễ dàng tìm kiếm và cùng kết nối, đồng hành duy trì chuỗi học tập.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Profile info & password (takes 7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          {/* Profile Card & Info Edit */}
          <div className="bg-white border-4 border-slate-950 rounded-3xl p-6 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]">
            <div className="flex items-center gap-3 border-b-4 border-slate-950 pb-4 mb-6">
              <div className="p-2 bg-pink-300 text-slate-950 border-2 border-slate-950 rounded-xl shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)]">
                <User className="h-5 w-5 stroke-[2.5]" />
              </div>
              <h3 className="font-black text-lg text-slate-950 uppercase tracking-tight">Thông Tin Tài Khoản</h3>
            </div>

            {/* Avatar block with automated compression */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative group">
                <div className="w-28 h-28 rounded-full border-4 border-slate-950 shadow-[3px_3px_0px_0px_rgba(2,6,23,1)] overflow-hidden bg-slate-50 flex items-center justify-center relative">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Profile avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-black text-4xl text-slate-950">
                      {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                    </span>
                  )}
                </div>
                
                {/* Overlay camera button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2.5 bg-yellow-300 hover:bg-yellow-400 border-2 border-slate-950 rounded-full shadow-[2px_2px_0px_0px_rgba(2,6,23,1)] transition-all cursor-pointer transform hover:scale-105"
                  title="Thay đổi ảnh đại diện (Tự động nén dung lượng)"
                >
                  <Camera className="h-4.5 w-4.5 stroke-[2.5] text-slate-950" />
                </button>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-3">
                Hệ thống tự động tối ưu & nén dung lượng ảnh cực tốt!
              </p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              {/* Notifications */}
              {profileSuccess && (
                <div className="bg-emerald-100 border-2 border-slate-950 p-3 rounded-xl flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-xs text-slate-950 font-bold">{profileSuccess}</p>
                </div>
              )}

              {profileError && (
                <div className="bg-rose-100 border-2 border-slate-950 p-3 rounded-xl flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                  <p className="text-xs text-slate-950 font-bold">{profileError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-black text-slate-950 uppercase tracking-wider mb-1.5">TÊN HIỂN THỊ CỦA BẠN</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Họ và tên hoặc Biệt danh"
                    className="w-full bg-slate-50 border-2 border-slate-950 text-slate-900 text-sm font-bold rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-950 uppercase tracking-wider mb-1.5">USERNAME CỦA BẠN (@)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-slate-400 font-extrabold text-sm">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="vd_phong123"
                      className="w-full bg-slate-50 border-2 border-slate-950 text-slate-900 text-sm font-bold rounded-xl py-2.5 pl-8 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold mt-1.5 uppercase">
                    chữ thường, số, gạch dưới, 3-15 ký tự. dùng để tìm bạn bè.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-950 uppercase tracking-wider mb-1.5">ĐỊA CHỈ EMAIL</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full bg-slate-100 border-2 border-slate-950 text-slate-500 text-sm font-bold rounded-xl py-3 px-4 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)] cursor-not-allowed opacity-75"
                />
                <p className="text-[10px] text-slate-500 font-bold mt-1.5 uppercase">Địa chỉ email liên kết không thể thay đổi</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="w-full bg-indigo-300 hover:bg-indigo-400 disabled:bg-slate-300 border-2 border-slate-950 text-slate-950 text-xs sm:text-sm font-black py-3 rounded-xl shadow-[3px_3px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:pointer-events-none"
                >
                  {isUpdatingProfile ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : null}
                  Cập Nhật Hồ Sơ
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-white border-4 border-slate-950 rounded-3xl p-6 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]">
            <div className="flex items-center gap-3 border-b-4 border-slate-950 pb-4 mb-6">
              <div className="p-2 bg-indigo-300 text-slate-950 border-2 border-slate-950 rounded-xl shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)]">
                <Key className="h-5 w-5 stroke-[2.5]" />
              </div>
              <h3 className="font-black text-lg text-slate-950 uppercase tracking-tight">Thay Đổi Mật Khẩu</h3>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-5">
              {/* Notifications */}
              {passwordSuccess && (
                <div className="bg-emerald-100 border-2 border-slate-950 p-3 rounded-xl flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  <p className="text-xs text-slate-950 font-bold">{passwordSuccess}</p>
                </div>
              )}

              {passwordError && (
                <div className="bg-rose-100 border-2 border-slate-950 p-3 rounded-xl flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                  <p className="text-xs text-slate-950 font-bold">{passwordError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-black text-slate-950 uppercase tracking-wider mb-1.5">MẬT KHẨU MỚI</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ít nhất 6 ký tự"
                    className="w-full bg-slate-50 border-2 border-slate-950 text-slate-900 text-sm font-bold rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-950 uppercase tracking-wider mb-1.5">XÁC NHẬN MẬT KHẨU MỚI</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full bg-slate-50 border-2 border-slate-950 text-slate-900 text-sm font-bold rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full bg-rose-300 hover:bg-rose-400 disabled:bg-slate-300 border-2 border-slate-950 text-slate-950 text-xs sm:text-sm font-black py-3 rounded-xl shadow-[3px_3px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:pointer-events-none"
                >
                  {isUpdatingPassword ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : null}
                  Cập Nhật Mật Khẩu
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Friends & Social Connections (takes 5 cols) */}
        <div className="lg:col-span-5 h-full">
          <div className="bg-white border-4 border-slate-950 rounded-3xl p-6 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)] flex flex-col justify-between min-h-[580px]">
            <div>
              <div className="flex items-center gap-3 border-b-4 border-slate-950 pb-4 mb-6">
                <div className="p-2 bg-yellow-300 text-slate-950 border-2 border-slate-950 rounded-xl shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)]">
                  <Users className="h-5 w-5 stroke-[2.5]" />
                </div>
                <h3 className="font-black text-lg text-slate-950 uppercase tracking-tight">Bạn Bè & Tương Tác</h3>
              </div>

              {/* Friend search form */}
              <form onSubmit={handleSearchFriends} className="mb-6">
                <label className="block text-xs font-black text-slate-950 uppercase tracking-wider mb-2">Tìm kiếm bạn bè</label>
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-400" />
                    <input
                      type="text"
                      value={friendSearchQuery}
                      onChange={(e) => setFriendSearchQuery(e.target.value)}
                      placeholder="Nhập username của bạn bè..."
                      className="w-full bg-slate-50 border-2 border-slate-950 text-slate-900 text-sm font-bold rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400 shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="bg-indigo-300 hover:bg-indigo-400 border-2 border-slate-950 text-slate-950 font-black text-xs px-4 rounded-xl shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isSearching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    Tìm
                  </button>
                </div>
              </form>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="bg-amber-50 border-2 border-slate-950 rounded-2xl p-4 mb-6 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-wide mb-3">Kết quả tìm kiếm</h4>
                  <div className="space-y-3">
                    {searchResults.map((res) => {
                      const isAlreadyFriend = user.friends?.includes(res.uid);
                      return (
                        <div key={res.uid} className="flex items-center justify-between bg-white border-2 border-slate-950 rounded-xl p-3 shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)]">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-9 h-9 rounded-full border-2 border-slate-950 overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                              {res.avatarUrl ? (
                                <img src={res.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-extrabold text-sm text-slate-950">{res.displayName.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-black text-slate-950 truncate">{res.displayName}</p>
                              <p className="text-[10px] text-slate-500 font-bold truncate">@{res.username || "chua_co_username"}</p>
                            </div>
                          </div>
                          {isAlreadyFriend ? (
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-black px-2.5 py-1 rounded-lg border-2 border-slate-950">Bạn bè</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddFriendAction(res.uid)}
                              className="bg-emerald-300 hover:bg-emerald-400 border-2 border-slate-950 text-slate-950 text-[10px] font-black px-3 py-1 rounded-xl shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)] cursor-pointer flex items-center gap-0.5"
                            >
                              <UserPlus className="h-3 w-3" /> Kết Bạn
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Friend action status */}
              {friendActionSuccess && (
                <div className="mb-4 bg-emerald-50 border-2 border-emerald-500 text-emerald-800 p-2.5 rounded-xl text-xs font-bold shadow-sm">
                  {friendActionSuccess}
                </div>
              )}
              {friendActionError && (
                <div className="mb-4 bg-rose-50 border-2 border-rose-400 text-rose-800 p-2.5 rounded-xl text-xs font-bold shadow-sm">
                  {friendActionError}
                </div>
              )}

              {/* Friend List */}
              <h4 className="text-xs font-black text-slate-950 uppercase tracking-wide mb-3 flex items-center justify-between">
                <span>Danh sách bạn bè ({friendsList.length})</span>
                {isLoadingFriends && <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-500" />}
              </h4>

              {friendsList.length === 0 ? (
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center text-xs text-slate-400 font-sans leading-relaxed bg-slate-50/50">
                  <p className="font-extrabold text-slate-500 mb-1">Chưa có bạn bè 👥</p>
                  <p>Hãy thiết lập username của mình, rồi tìm kiếm username bạn bè ở trên để kết nối và đua chuỗi cùng nhau nhé!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {friendsList.map((f) => (
                    <div key={f.uid} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 border-2 border-slate-950 rounded-2xl p-3 shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)] transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-full border-2 border-slate-950 overflow-hidden bg-white flex items-center justify-center shrink-0">
                          {f.avatarUrl ? (
                            <img src={f.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-extrabold text-sm text-slate-950">{f.displayName.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-950 truncate">{f.displayName}</p>
                          <p className="text-[10px] text-slate-500 font-bold truncate">@{f.username || "chua_co_handle"}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFriendAction(f.uid)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 border-2 border-slate-950 rounded-xl shadow-[1px_1px_0px_0px_rgba(2,6,23,1)] transition-all text-rose-600 hover:text-rose-700 cursor-pointer"
                        title="Hủy kết bạn"
                      >
                        <UserMinus className="h-4 w-4 stroke-[2.5]" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-cyan-50 border-2 border-slate-950 rounded-2xl p-4 flex items-start gap-3 mt-6">
              <Heart className="h-5 w-5 text-rose-500 fill-rose-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="text-[11px] text-slate-850 leading-relaxed font-bold">
                <h5 className="font-black text-slate-950 uppercase tracking-wide">Cùng nhóm, cùng tiến! 🏆</h5>
                <p>Nối vòng tay lớn với bạn bè để cùng nhau nỗ lực vượt mốc 10, 30, 50 ngày duy trì chuỗi học tập nhé!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
