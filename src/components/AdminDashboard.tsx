import React, { useState, useEffect } from "react";
import { AppUser, VocabularySet, Word, Subject, CommunitySettings } from "../types";
import { 
  addVocabularySet, 
  updateVocabularySet, 
  deleteVocabularySet, 
  subscribeToVocabularySets,
  addSubject,
  updateSubject,
  deleteSubject,
  subscribeToSubjects
} from "../services/flashcardService";
import { updateCommunitySettings } from "../services/communityService";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { importGoogleSheets, checkAndTriggerDailyReset } from "../services/googleSheetsService";
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  BookOpen, 
  UserCheck, 
  RefreshCw, 
  X, 
  ChevronRight, 
  Check,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Link2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AdminDashboardProps {
  user: AppUser;
  communitySettings?: CommunitySettings | null;
}

export default function AdminDashboard({ user, communitySettings }: AdminDashboardProps) {
  const [sets, setSets] = useState<VocabularySet[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Subject states
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState("");

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [setTitle, setSetTitle] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "subjects" | "community" | "sheets">("subjects");
  const [selectedSubjectForSets, setSelectedSubjectForSets] = useState<Subject | null>(null);

  // Google Sheets & Daily words states
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [sheetsConfig, setSheetsConfig] = useState<any>(null);
  const [dailyState, setDailyState] = useState<any>(null);
  const [loadingSheetsData, setLoadingSheetsData] = useState(false);

  // Community link form states
  const [zaloUrl, setZaloUrl] = useState("");
  const [zaloTitle, setZaloTitle] = useState("");
  const [zaloDesc, setZaloDesc] = useState("");
  const [zaloActive, setZaloActive] = useState(true);
  const [discordUrl, setDiscordUrl] = useState("");
  const [discordTitle, setDiscordTitle] = useState("");
  const [discordDesc, setDiscordDesc] = useState("");
  const [discordActive, setDiscordActive] = useState(true);
  const [facebookUrl, setFacebookUrl] = useState("");
  const [facebookTitle, setFacebookTitle] = useState("");
  const [facebookDesc, setFacebookDesc] = useState("");
  const [facebookActive, setFacebookActive] = useState(true);

  useEffect(() => {
    if (communitySettings) {
      setZaloUrl(communitySettings.zaloUrl || "");
      setZaloTitle(communitySettings.zaloTitle || "");
      setZaloDesc(communitySettings.zaloDesc || "");
      setZaloActive(communitySettings.zaloActive !== false);
      setDiscordUrl(communitySettings.discordUrl || "");
      setDiscordTitle(communitySettings.discordTitle || "");
      setDiscordDesc(communitySettings.discordDesc || "");
      setDiscordActive(communitySettings.discordActive !== false);
      setFacebookUrl(communitySettings.facebookUrl || "");
      setFacebookTitle(communitySettings.facebookTitle || "");
      setFacebookDesc(communitySettings.facebookDesc || "");
      setFacebookActive(communitySettings.facebookActive !== false);
    }
  }, [communitySettings]);

  // Error/Success messages
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Custom Toast state
  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    message: "",
    type: "success"
  });

  // Helper to trigger custom confirmations
  const askConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    isDanger = false,
    confirmText = "Xác nhận",
    cancelText = "Hủy"
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: async () => {
        try {
          await onConfirm();
        } catch (err: any) {
          showToast(err.message || "Đã xảy ra lỗi!", "error");
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      },
      confirmText,
      cancelText,
      isDanger
    });
  };

  // Helper to show custom toasts
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ isOpen: true, message, type });
  };

  useEffect(() => {
    if (toast.isOpen) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, isOpen: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.isOpen, toast.message]);

  // Subscribe to vocabulary sets
  useEffect(() => {
    setLoadingSets(true);
    const unsubscribe = subscribeToVocabularySets((allSets) => {
      setSets(allSets);
      setLoadingSets(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to subjects
  useEffect(() => {
    setLoadingSubjects(true);
    const unsubscribe = subscribeToSubjects((allSubjects) => {
      setSubjects(allSubjects);
      setLoadingSubjects(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch registered users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const usersCol = collection(db, "users");
      const snap = await getDocs(usersCol);
      const list: AppUser[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as AppUser);
      });
      setUsersList(list);
    } catch (error) {
      console.error("Lỗi tải người dùng:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    }
  }, [activeTab]);

  const fetchSheetsData = async () => {
    setLoadingSheetsData(true);
    try {
      const configRef = doc(db, "config", "daily_sheets");
      const configSnap = await getDoc(configRef);
      if (configSnap.exists()) {
        const configData = configSnap.data();
        setSheetsConfig(configData);
        if (configData.sheetUrl) {
          setSheetUrlInput(configData.sheetUrl);
        }
      } else {
        setSheetsConfig(null);
      }

      const stateRef = doc(db, "config", "daily_state");
      const stateSnap = await getDoc(stateRef);
      if (stateSnap.exists()) {
        setDailyState(stateSnap.data());
      } else {
        setDailyState(null);
      }
    } catch (err) {
      console.error("Lỗi tải thông tin Google Sheets:", err);
    } finally {
      setLoadingSheetsData(false);
    }
  };

  useEffect(() => {
    if (activeTab === "sheets") {
      fetchSheetsData();
    }
  }, [activeTab]);

  // Handle adding a blank word slot to the form
  const handleAddWordSlot = () => {
    const newWord: Word = {
      id: `w_temp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      english: "",
      vietnamese: "",
      example: "",
      phonetic: ""
    };
    setWords([...words, newWord]);
  };

  // Handle updating a specific field on a word in the form
  const handleWordFieldChange = (index: number, field: keyof Word, value: string) => {
    const updatedWords = [...words];
    updatedWords[index] = {
      ...updatedWords[index],
      [field]: value
    };
    setWords(updatedWords);
  };

  // Handle removing a word from the form
  const handleRemoveWordSlot = (index: number) => {
    const updatedWords = words.filter((_, idx) => idx !== index);
    setWords(updatedWords);
  };

  // Populate form for editing
  const handleStartEdit = (set: VocabularySet) => {
    setIsEditing(true);
    setEditingSetId(set.id);
    setSetTitle(set.title);
    setSetDescription(set.description);
    setWords(set.words || []);
    setSelectedSubjectId(set.subjectId || "");
    setActionError("");
    setActionSuccess("");
  };

  // Start a fresh empty form
  const handleStartNew = () => {
    setIsEditing(true);
    setEditingSetId(null);
    setSetTitle("");
    setSetDescription("");
    setSelectedSubjectId(selectedSubjectForSets ? selectedSubjectForSets.id : (subjects.length > 0 ? subjects[0].id : ""));
    setWords([
      {
        id: `w_temp_${Date.now()}`,
        english: "",
        vietnamese: "",
        example: "",
        phonetic: ""
      }
    ]);
    setActionError("");
    setActionSuccess("");
  };

  // Cancel edit/create
  const handleCancelForm = () => {
    setIsEditing(false);
    setEditingSetId(null);
    setSetTitle("");
    setSetDescription("");
    setSelectedSubjectId("");
    setWords([]);
  };

  // Submit form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");

    if (!selectedSubjectId) {
      setActionError("Vui lòng chọn môn học cho bộ từ vựng!");
      return;
    }
    if (!setTitle.trim()) {
      setActionError("Vui lòng nhập tiêu đề bộ từ vựng!");
      return;
    }
    if (words.length === 0) {
      setActionError("Bộ từ vựng cần có ít nhất 1 từ!");
      return;
    }

    // Validate words inputs
    for (let i = 0; i < words.length; i++) {
      if (!words[i].english.trim() || !words[i].vietnamese.trim()) {
        setActionError(`Vui lòng nhập đầy đủ từ tiếng Anh và nghĩa tiếng Việt tại từ thứ ${i + 1}!`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Clean word IDs before submission
      const cleanedWords = words.map((w, idx) => ({
        id: editingSetId ? w.id : `w_${Date.now()}_${idx}`,
        english: w.english.trim(),
        vietnamese: w.vietnamese.trim(),
        example: w.example?.trim() || "",
        phonetic: w.phonetic?.trim() || ""
      }));

      if (editingSetId) {
        await updateVocabularySet(editingSetId, setTitle.trim(), setDescription.trim(), cleanedWords, selectedSubjectId);
        setActionSuccess("Cập nhật bộ từ vựng thành công!");
      } else {
        await addVocabularySet(setTitle.trim(), setDescription.trim(), cleanedWords, selectedSubjectId);
        setActionSuccess("Thêm mới bộ từ vựng thành công!");
      }
      
      // Close form on success after a short delay
      setTimeout(() => {
        handleCancelForm();
      }, 1000);
    } catch (error: any) {
      setActionError(error.message || "Lỗi thao tác dữ liệu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle deleting a set
  const handleDeleteSet = async (setId: string, title: string) => {
    askConfirmation(
      "Xóa bộ từ vựng",
      `Bạn có chắc chắn muốn xóa vĩnh viễn bộ từ vựng "${title}" không? Thao tác này không thể hoàn tác.`,
      async () => {
        await deleteVocabularySet(setId);
        showToast("Đã xóa bộ từ vựng thành công!", "success");
      },
      true,
      "Xóa bộ từ vựng",
      "Hủy"
    );
  };

  // Handle updating community links in real-time
  const handleUpdateCommunityLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");
    setIsSubmitting(true);

    try {
      const updatedSettings: CommunitySettings = {
        zaloUrl: zaloUrl.trim(),
        zaloTitle: zaloTitle.trim() || "Cộng Đồng Zalo",
        zaloDesc: zaloDesc.trim(),
        zaloActive,
        discordUrl: discordUrl.trim(),
        discordTitle: discordTitle.trim() || "Server Discord Học Tập",
        discordDesc: discordDesc.trim(),
        discordActive,
        facebookUrl: facebookUrl.trim(),
        facebookTitle: facebookTitle.trim() || "Group Facebook Săn Học Bổng",
        facebookDesc: facebookDesc.trim(),
        facebookActive
      };

      await updateCommunitySettings(updatedSettings);
      showToast("Cập nhật liên kết cộng đồng thành công!", "success");
      setActionSuccess("Cập nhật liên kết cộng đồng thành công!");
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || "Không thể cập nhật liên kết cộng đồng.");
      showToast("Cập nhật thất bại!", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-1.5 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider mb-2">
              <Shield className="h-4.5 w-4.5" /> CHẾ ĐỘ QUẢN TRỊ VIÊN
            </div>
            <h2 className="text-2xl sm:text-3xl font-sans font-extrabold text-white tracking-tight">
              Trang Quản Trị Từ Vựng & Thành Viên
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Thêm mới hoặc biên soạn lại các bộ từ vựng tiếng Anh theo ngày/chủ đề học tập, hoặc kiểm soát danh sách tài khoản học sinh trong hệ thống.
            </p>
          </div>

          <div className="flex space-x-1 bg-slate-950 p-1.5 rounded-xl border border-slate-800/80">
            <button
              onClick={() => {
                setActiveTab("subjects");
                setSelectedSubjectForSets(null);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "subjects" ? "bg-rose-500 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Quản Lý Môn Học
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "users" ? "bg-rose-500 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Học Sinh
            </button>
            <button
              onClick={() => setActiveTab("community")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "community" ? "bg-rose-500 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Cộng Đồng
            </button>
            <button
              onClick={() => setActiveTab("sheets")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "sheets" ? "bg-rose-500 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Nhập Google Sheets
            </button>
          </div>
        </div>
      </div>

      {/* Main Admin Content */}
      {isEditing ? (
        /* RENDER FORM: ADD/EDIT SET */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-800/60">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-rose-400" />
              {editingSetId ? "Biên soạn chủ đề từ vựng" : "Tạo chủ đề từ vựng mới"}
            </h3>
            <button onClick={handleCancelForm} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>

          {actionError && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs font-mono font-medium">
              {actionError}
            </div>
          )}
          {actionSuccess && (
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-mono font-medium">
              {actionSuccess}
            </div>
          )}

          <form onSubmit={handleSubmitForm} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-400 uppercase mb-1">
                    Môn học / Danh mục: <span className="text-rose-400">*</span>
                  </label>
                  {selectedSubjectForSets ? (
                    <div className="w-full bg-slate-950 border border-slate-800/80 text-slate-400 text-sm py-2.5 px-4 rounded-xl flex items-center justify-between">
                      <span className="font-extrabold text-white">{selectedSubjectForSets.name}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full font-black tracking-wider uppercase">Khóa môn học</span>
                    </div>
                  ) : (
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 text-white text-sm py-2.5 px-4 rounded-xl focus:outline-none"
                      required
                    >
                      <option value="">-- Chọn môn học --</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} {!sub.isActive ? "(Ẩn)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-400 uppercase mb-1">
                    Tiêu đề chủ đề:
                  </label>
                  <input
                    type="text"
                    value={setTitle}
                    onChange={(e) => setSetTitle(e.target.value)}
                    placeholder="Ví dụ: Ngày 4: Đi Du Lịch"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 text-white text-sm py-2.5 px-4 rounded-xl focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-400 uppercase mb-1">
                    Mô tả chủ đề:
                  </label>
                  <textarea
                    value={setDescription}
                    onChange={(e) => setSetDescription(e.target.value)}
                    placeholder="Mô tả ngắn gọn nội dung bài học..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 text-white text-sm py-2.5 px-4 rounded-xl focus:outline-none resize-none"
                  />
                </div>
              </div>

              {/* Word List Builder (Right 2 cols) */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                    DANH SÁCH TỪ VỰNG ({words.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddWordSlot}
                    className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm từ vựng
                  </button>
                </div>

                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 border-t border-slate-800/40 pt-4">
                  {words.map((word, idx) => (
                    <div key={word.id || idx} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 relative space-y-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveWordSlot(idx)}
                        className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Xóa từ này"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="text-xs font-mono text-slate-500">Từ thứ {idx + 1}</div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <input
                            type="text"
                            value={word.english}
                            onChange={(e) => handleWordFieldChange(idx, "english", e.target.value)}
                            placeholder="Tiếng Anh (ví dụ: Devote)"
                            className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2 px-3 rounded-lg focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={word.phonetic}
                            onChange={(e) => handleWordFieldChange(idx, "phonetic", e.target.value)}
                            placeholder="Phiên âm (ví dụ: /dɪˈvoʊt/)"
                            className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2 px-3 rounded-lg focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <input
                            type="text"
                            value={word.vietnamese}
                            onChange={(e) => handleWordFieldChange(idx, "vietnamese", e.target.value)}
                            placeholder="Nghĩa tiếng Việt (ví dụ: Cống hiến, dành hết cho)"
                            className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2 px-3 rounded-lg focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={word.example}
                            onChange={(e) => handleWordFieldChange(idx, "example", e.target.value)}
                            placeholder="Ví dụ câu tiếng Anh (ví dụ: She devoted her life to helping the poor.)"
                            className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2 px-3 rounded-lg focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-800/60">
              <button
                type="button"
                onClick={handleCancelForm}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-sm py-2.5 px-5 rounded-xl transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-rose-500 hover:bg-rose-600 disabled:bg-rose-500/50 text-white font-semibold text-sm py-2.5 px-6 rounded-xl shadow-lg shadow-rose-500/10 flex items-center gap-1 transition-all"
              >
                {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4.5 w-4.5" />}
                {editingSetId ? "Lưu thay đổi" : "Xuất bản bộ từ"}
              </button>
            </div>
          </form>
        </div>
      ) : activeTab === "subjects" ? (
        /* RENDER SUBJECTS TAB */
        selectedSubjectForSets ? (
          /* Manage Vocabulary Sets for this selected subject */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <button
                  onClick={() => setSelectedSubjectForSets(null)}
                  className="mb-2 px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700/50"
                >
                  ← Quay lại danh sách môn học
                </button>
                <h3 className="font-sans font-extrabold text-xl text-white flex items-center gap-2">
                  Môn Học: <span className="text-rose-400">{selectedSubjectForSets.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Quản lý các bộ từ vựng / bài học flashcard nằm trong môn {selectedSubjectForSets.name}.
                </p>
              </div>

              <button
                onClick={handleStartNew}
                className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold py-2.5 px-5 rounded-xl flex items-center gap-1.5 transition-all shadow-md hover:scale-102 active:scale-98 cursor-pointer self-start sm:self-center"
              >
                <Plus className="h-4 w-4" /> Thêm bộ từ vựng mới
              </button>
            </div>

            {loadingSets ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 font-mono text-sm">
                <RefreshCw className="h-6 w-6 animate-spin text-rose-500 mb-2" /> Đang tải danh sách bài...
              </div>
            ) : sets.filter(s => s.subjectId === selectedSubjectForSets.id).length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center text-slate-500">
                <BookOpen className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                Môn học này chưa có bộ từ vựng nào. Hãy nhấn "Thêm bộ từ vựng mới" ở trên để tạo bộ flashcard đầu tiên!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sets
                  .filter(s => s.subjectId === selectedSubjectForSets.id)
                  .map((set) => (
                    <div key={set.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-md hover:border-slate-750 transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-3 text-[10px] font-mono text-slate-500">
                          <span>{set.wordsCount} từ vựng</span>
                          <span>Mã ID: {set.id}</span>
                        </div>
                        <h4 className="font-bold text-white text-base mb-1">{set.title}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-6">{set.description}</p>
                      </div>

                      <div className="flex justify-end gap-2 border-t border-slate-800/60 pt-4">
                        <button
                          onClick={() => handleStartEdit(set)}
                          className="p-2 bg-slate-800 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/20 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Edit className="h-3.5 w-3.5" /> Chỉnh sửa
                        </button>
                        <button
                          onClick={() => handleDeleteSet(set.id, set.title)}
                          className="p-2 bg-slate-800 hover:bg-rose-500/10 text-slate-300 hover:text-rose-500 border border-slate-700/60 hover:border-rose-500/20 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Xóa bỏ
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ) : (
          /* RENDER SUBJECTS TAB - LIST & CREATE */
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
              <h3 className="font-sans font-extrabold text-xl text-white mb-2 flex items-center gap-2">
                <Plus className="h-5 w-5 text-rose-400" /> Thêm Môn Học Mới
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-lg">
                Tạo danh mục môn học mới (ví dụ: Địa lý, Sinh học, Lịch sử...) để phân loại các bộ từ vựng theo đúng giáo trình giảng dạy.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                <input
                  type="text"
                  placeholder="Tên môn học mới..."
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-rose-500 text-white text-sm py-3 px-4 rounded-xl focus:outline-none transition-all focus:ring-1 focus:ring-rose-500/20"
                />
                <button
                  onClick={async () => {
                    if (!newSubjectName.trim()) {
                      showToast("Vui lòng nhập tên môn học!", "error");
                      return;
                    }
                    try {
                      await addSubject(newSubjectName.trim());
                      setNewSubjectName("");
                      showToast(`Đã thêm môn học "${newSubjectName.trim()}" thành công!`, "success");
                    } catch (err: any) {
                      showToast("Lỗi: " + err.message, "error");
                    }
                  }}
                  className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20 flex items-center justify-center gap-1.5 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Plus className="h-4 w-4" /> Thêm mới
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-sans font-extrabold text-lg text-white flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-400" /> Danh Sách Môn Học Hiện Có
                  <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-0.5 rounded-full font-mono">{subjects.length}</span>
                </h3>
              </div>

              {loadingSubjects ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 font-mono text-sm">
                  <RefreshCw className="h-7 w-7 animate-spin text-rose-500 mb-3" /> Đang tải dữ liệu môn học...
                </div>
              ) : subjects.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-16 text-center text-slate-500">
                  <BookOpen className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  Chưa có môn học nào được tạo. Nhập tên môn học bên trên để khởi tạo!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {subjects.map((sub) => (
                    <div 
                      key={sub.id} 
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
                          return;
                        }
                        setSelectedSubjectForSets(sub);
                      }}
                      className="bg-slate-900 border border-slate-800/80 hover:border-rose-500/30 rounded-2xl p-6 flex flex-col justify-between shadow-lg hover:shadow-rose-500/5 transition-all duration-300 relative group overflow-hidden cursor-pointer"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-rose-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div>
                        {editingSubjectId === sub.id ? (
                          <div className="space-y-3">
                            <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase">
                              Chỉnh sửa tên môn học
                            </label>
                            <input
                              type="text"
                              value={editingSubjectName}
                              onChange={(e) => setEditingSubjectName(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 text-white text-sm py-2 px-3 rounded-lg focus:outline-none"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!editingSubjectName.trim()) {
                                    showToast("Tên môn học không được để trống!", "error");
                                    return;
                                  }
                                  try {
                                    await updateSubject(sub.id, editingSubjectName.trim(), sub.isActive);
                                    setEditingSubjectId(null);
                                    showToast("Đã cập nhật tên môn học thành công!", "success");
                                  } catch (err: any) {
                                    showToast("Lỗi: " + err.message, "error");
                                  }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1.5 px-4 rounded-lg cursor-pointer transition-all"
                              >
                                Lưu lại
                              </button>
                              <button
                                onClick={() => setEditingSubjectId(null)}
                                className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] font-bold py-1.5 px-4 rounded-lg cursor-pointer transition-all"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-white text-base group-hover:text-rose-400 transition-colors">
                                {sub.name}
                              </h4>
                              <div className="text-[10px] font-mono text-slate-500">ID: {sub.id}</div>
                            </div>
                            
                            <span className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[10px] font-bold font-sans ${
                              sub.isActive 
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" 
                                : "bg-slate-800/80 text-slate-500 border border-slate-800"
                            }`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${sub.isActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
                              {sub.isActive ? "Hoạt động" : "Đã ẩn"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quản lý flashcard primary button */}
                      <div className="mt-6 pt-4 border-t border-slate-800/60">
                        <button
                          onClick={() => setSelectedSubjectForSets(sub)}
                          className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-98 cursor-pointer"
                        >
                          <BookOpen className="h-3.5 w-3.5" /> Quản lý Flashcard ({sets.filter(s => s.subjectId === sub.id).length})
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => {
                            setEditingSubjectId(sub.id);
                            setEditingSubjectName(sub.name);
                          }}
                          className="p-2 bg-slate-800/60 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all border border-slate-800 hover:border-slate-700 flex-1 flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Chỉnh sửa tên môn học"
                        >
                          <Edit className="h-3.5 w-3.5" /> Sửa tên
                        </button>

                        <button
                          onClick={() => {
                            const action = sub.isActive ? "ẩn" : "hiện";
                            askConfirmation(
                              sub.isActive ? "Ẩn môn học?" : "Hiện môn học?",
                              `Bạn có chắc chắn muốn ${action} môn học "${sub.name}"? Khi môn học bị ẩn, học sinh sẽ không nhìn thấy bất kì bộ từ vựng nào thuộc môn học này ở giao diện học tập chính.`,
                              async () => {
                                await updateSubject(sub.id, sub.name, !sub.isActive);
                                showToast(`Đã ${action} môn học thành công!`, "success");
                              }
                            );
                          }}
                          className={`p-2 rounded-xl text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 cursor-pointer flex-1 ${
                            sub.isActive 
                              ? "bg-slate-800/60 hover:bg-amber-500/10 text-amber-400 border-slate-800 hover:border-amber-500/20"
                              : "bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-400 border-emerald-500/15"
                          }`}
                          title={sub.isActive ? "Ẩn môn học" : "Hiện môn học"}
                        >
                          {sub.isActive ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" /> Ẩn đi
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" /> Kích hoạt
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            askConfirmation(
                              "Xóa vĩnh viễn môn học?",
                              `Bạn có thực sự muốn xóa môn học "${sub.name}"? Tất cả dữ liệu của môn học này sẽ bị xóa. Thao tác này không thể thu hồi và ảnh hưởng trực tiếp đến học sinh!`,
                              async () => {
                                await deleteSubject(sub.id);
                                showToast(`Đã xóa thành công môn học "${sub.name}"!`, "success");
                              },
                              true,
                              "Xóa vĩnh viễn"
                            );
                          }}
                          className="p-2 bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-400 rounded-xl text-xs font-semibold transition-all border border-rose-500/20 shadow-md hover:shadow-rose-600/20 hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer flex-1"
                          title="Xóa môn học vĩnh viễn"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500 group-hover:text-white" /> Xóa môn
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      ) : activeTab === "users" ? (
        /* RENDER VIEW 2: REGISTERED USERS */
        <div className="space-y-6">
          <h3 className="font-sans font-bold text-lg text-white">Danh Sách Học Sinh & Tài Khoản ({usersList.length})</h3>

          {loadingUsers ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 font-mono text-sm">
              <RefreshCw className="h-6 w-6 animate-spin text-rose-500 mb-2" /> Đang tải danh sách người dùng...
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase border-b border-slate-800">
                    <th className="py-4 px-6">Tên Hiển Thị</th>
                    <th className="py-4 px-6">Địa Chỉ Email</th>
                    <th className="py-4 px-6">Phân Quyền (Role)</th>
                    <th className="py-4 px-6">Nhóm Đang Tham Gia (Group ID)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {usersList.map((usr) => (
                    <tr key={usr.uid} className="hover:bg-slate-950/20 transition-colors">
                      <td className="py-4 px-6 font-bold text-white">{usr.displayName}</td>
                      <td className="py-4 px-6 text-slate-300 font-mono">{usr.email}</td>
                      <td className="py-4 px-6">
                        <span className={`py-0.5 px-2.5 rounded-full text-[10px] font-bold font-mono tracking-wide ${
                          usr.role === "admin" ? "bg-rose-500/15 text-rose-400 border border-rose-500/25" : "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25"
                        }`}>
                          {usr.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-400">
                        {usr.groupId ? (
                          <span className="text-indigo-400">{usr.groupId}</span>
                        ) : (
                          <span className="text-slate-600">Chưa tham gia nhóm</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeTab === "sheets" ? (
        /* RENDER VIEW 4: GOOGLE SHEETS IMPORT & DAILY CONTROL PANEL */
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full filter blur-3xl pointer-events-none" />
            
            <h3 className="font-sans font-extrabold text-xl text-white mb-2 flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-400" /> Đồng Bộ Từ Vựng Từ Google Sheets Công Khai
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-2xl">
              Dán đường dẫn của file Google Sheets chứa kho từ vựng công khai của bạn vào ô bên dưới. Hệ thống sẽ tự động quét, phân tích cấu trúc CSV và đồng bộ vào cơ sở dữ liệu Firestore.
              <br />
              <strong className="text-amber-400">📝 YÊU CẦU ĐỊNH DẠNG SHEET (6 CỘT CHUẨN):</strong>
              <br />
              Cột 1: <code className="text-emerald-400">STT</code> (1 đến 2569) | Cột 2: <code className="text-emerald-400">Từ vựng</code> (English) | Cột 3: <code className="text-emerald-400">Phiên âm</code> | Cột 4: <code className="text-emerald-400">Nghĩa</code> (Tiếng Việt) | Cột 5: <code className="text-emerald-400">Ví dụ tiếng Anh</code> | Cột 6: <code className="text-emerald-400">Dịch ví dụ</code>.
            </p>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
              <label className="block text-xs font-mono font-bold text-slate-400 mb-1">
                ĐƯỜNG DẪN CHIA SẺ FILE GOOGLE SHEETS (BẤT KỲ AI CÓ LIÊN KẾT ĐỀU CÓ THỂ XEM):
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1cC5wCX8YTQOs7_Yleryv4DmCWEpzdfLTquMDqwtQnN4/edit?usp=sharing"
                  className="flex-grow bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white text-xs py-3 px-4 rounded-xl focus:outline-none"
                  disabled={isImporting}
                />
                <button
                  onClick={async () => {
                    if (!sheetUrlInput.trim()) {
                      showToast("Vui lòng nhập đường dẫn Google Sheets!", "error");
                      return;
                    }
                    setIsImporting(true);
                    try {
                      const totalImported = await importGoogleSheets(sheetUrlInput.trim());
                      showToast(`Đồng bộ thành công ${totalImported} từ vựng từ Google Sheets!`, "success");
                      await fetchSheetsData();
                    } catch (err: any) {
                      showToast(err.message || "Lỗi đồng bộ dữ liệu từ sheet", "error");
                    } finally {
                      setIsImporting(false);
                    }
                  }}
                  disabled={isImporting}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold text-xs py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Đang phân tích & lưu...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Đồng bộ dữ liệu
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* POOL & CONTROL SECTION */}
          {loadingSheetsData ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 font-mono text-sm">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-500 mb-2" /> Đang tải thông tin cấu hình từ vựng...
            </div>
          ) : !sheetsConfig ? (
            <div className="bg-slate-900 border border-dashed border-slate-800 rounded-3xl p-12 text-center text-slate-400 shadow-sm">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
              <p className="text-base font-bold text-white">Chưa đồng bộ kho từ vựng</p>
              <p className="text-xs mt-1.5 text-slate-400 max-w-md mx-auto">
                Hãy dán link Google Sheets công khai ở phía trên và bấm "Đồng bộ dữ liệu" để khởi tạo kho từ vựng 2569 từ cho học sinh học mỗi ngày.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left col: Statistics & force controls */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
                  <h4 className="font-sans font-bold text-base text-white border-b border-slate-800 pb-3 flex items-center gap-2">
                    <Info className="h-4.5 w-4.5 text-emerald-400" /> Trạng Thái Kho Từ Vựng
                  </h4>

                  <div className="space-y-4 text-xs font-medium">
                    <div className="flex justify-between items-center bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Tổng số từ vựng:</span>
                      <span className="font-extrabold text-white text-sm bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">{sheetsConfig.totalWords} từ</span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Số lượng phân mảnh:</span>
                      <span className="font-mono text-white">{sheetsConfig.totalChunks} Chunks</span>
                    </div>

                    {dailyState && (
                      <div className="flex justify-between items-center bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                        <span className="text-slate-400">Từ đã dùng (Lịch sử):</span>
                        <span className="font-mono text-amber-400 font-bold">{dailyState.shownSTTs?.length || 0} / {sheetsConfig.totalWords} từ</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Ngày cập nhật gần nhất:</span>
                      <span className="font-mono text-white text-[10px]">
                        {sheetsConfig.importedAt ? new Date(sheetsConfig.importedAt.seconds * 1000).toLocaleString("vi-VN") : "N/A"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800">
                    <button
                      onClick={() => {
                        askConfirmation(
                          "Yêu cầu đổi mới 20 từ vựng?",
                          "Hệ thống sẽ chạy lại thuật toán chọn ngẫu nhiên 20 từ mới (loại trừ các từ đã dùng trong lịch sử của ngày hôm trước) và cập nhật ngay lập tức cho toàn bộ học sinh. Bạn có chắc muốn làm mới?",
                          async () => {
                            const newState = await checkAndTriggerDailyReset(true);
                            if (newState) {
                              showToast("Đã làm mới danh sách 20 từ vựng hôm nay thành công!", "success");
                              fetchSheetsData();
                            }
                          }
                        );
                      }}
                      className="w-full bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Làm Mới 20 Từ Random Hôm Nay (Force Reset)
                    </button>
                  </div>
                </div>
              </div>

              {/* Right cols: Display today's 20 active words */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4 mb-4">
                    <div>
                      <h4 className="font-sans font-bold text-base text-white">
                        🎯 20 Từ Vựng Ngẫu Nhiên Hôm Nay
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Tự động reset và đổi mới vào lúc 00:00 ICT theo giờ thực của ngày mới.
                      </p>
                    </div>
                    {dailyState && (
                      <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 py-1 px-3 rounded-full text-xs font-black font-mono">
                        📅 {dailyState.currentDate}
                      </span>
                    )}
                  </div>

                  {!dailyState || !Array.isArray(dailyState.activeWords) || dailyState.activeWords.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">Không tìm thấy danh sách từ hôm nay. Bấm làm mới ở cột bên để chạy random.</p>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {dailyState.activeWords.map((word: any, i: number) => (
                        <div key={word.id || i} className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex items-start gap-4">
                          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-slate-400">
                            #{word.stt}
                          </div>
                          <div className="flex-grow space-y-1">
                            <div className="flex items-baseline gap-2.5 flex-wrap">
                              <span className="text-white text-sm font-black font-sans">{word.english}</span>
                              <span className="text-violet-400 text-xs font-mono font-medium">{word.phonetic}</span>
                            </div>
                            <p className="text-xs text-slate-300 font-bold">{word.vietnamese}</p>
                            {word.example && (
                              <div className="mt-1.5 p-2 bg-slate-900/40 rounded-lg border border-slate-800 text-[10px] space-y-0.5 leading-relaxed">
                                <p className="text-slate-400 italic font-medium">"{word.example}"</p>
                                {word.exampleTranslate && <p className="text-slate-500 font-medium">{word.exampleTranslate}</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* RENDER VIEW 3: COMMUNITY LINKS FORM */
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />
            <h3 className="font-sans font-extrabold text-xl text-white mb-2 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-rose-400" /> Cấu Hình Liên Kết Cộng Đồng Toàn Web
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-2xl">
              Quản trị viên có quyền cập nhật tên, mô tả và đường dẫn cho các kênh cộng đồng (Zalo, Discord, Facebook). 
              <br />
              <strong className="text-amber-400">🚨 LƯU Ý QUAN TRỌNG:</strong> Nếu bạn để trống ô nhập đường dẫn (URL) của bất kỳ cộng đồng nào, hệ thống sẽ tự động <strong>ẩn hoàn toàn</strong> nút bấm và thẻ liên kết tương ứng trên toàn bộ website (bao gồm cả thanh điều hướng đầu trang và trang cộng đồng).
            </p>

            <form onSubmit={handleUpdateCommunityLinks} className="space-y-8">
              {/* ZALO CONFIG */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                    <h4 className="font-bold text-sm text-white uppercase tracking-wider">Cộng đồng Zalo</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setZaloActive(!zaloActive)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl border-2 border-slate-950 shadow-[1.5px_1.5px_0px_0px_rgba(255,255,255,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all cursor-pointer flex items-center gap-1.5 ${
                      zaloActive 
                        ? "bg-emerald-400 text-slate-950" 
                        : "bg-slate-800 text-slate-400 border-slate-700 shadow-none"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${zaloActive ? "bg-slate-950 animate-ping" : "bg-slate-500"}`} />
                    {zaloActive ? "Đang Bật (Hiển thị)" : "Đang Tắt (Ẩn đi)"}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-400 mb-1">TÊN HIỂN THỊ (Mặc định: Cộng Đồng Zalo)</label>
                    <input
                      type="text"
                      value={zaloTitle}
                      onChange={(e) => setZaloTitle(e.target.value)}
                      placeholder="Cộng Đồng Zalo"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2.5 px-3 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-400 mb-1">ĐƯỜNG DẪN LIÊN KẾT (URL)</label>
                    <input
                      type="text"
                      value={zaloUrl}
                      onChange={(e) => setZaloUrl(e.target.value)}
                      placeholder="https://zalo.me/g/..."
                      className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2.5 px-3 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-400 mb-1">MÔ TẢ NGẮN GỌN</label>
                  <input
                    type="text"
                    value={zaloDesc}
                    onChange={(e) => setZaloDesc(e.target.value)}
                    placeholder="Mô tả về nhóm Zalo của bạn..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2.5 px-3 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* DISCORD CONFIG */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                    <h4 className="font-bold text-sm text-white uppercase tracking-wider">Server Discord Học Tập</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDiscordActive(!discordActive)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl border-2 border-slate-950 shadow-[1.5px_1.5px_0px_0px_rgba(255,255,255,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all cursor-pointer flex items-center gap-1.5 ${
                      discordActive 
                        ? "bg-emerald-400 text-slate-950" 
                        : "bg-slate-800 text-slate-400 border-slate-700 shadow-none"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${discordActive ? "bg-slate-950 animate-ping" : "bg-slate-500"}`} />
                    {discordActive ? "Đang Bật (Hiển thị)" : "Đang Tắt (Ẩn đi)"}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-400 mb-1">TÊN HIỂN THỊ (Mặc định: Server Discord Học Tập)</label>
                    <input
                      type="text"
                      value={discordTitle}
                      onChange={(e) => setDiscordTitle(e.target.value)}
                      placeholder="Server Discord Học Tập"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2.5 px-3 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-400 mb-1">ĐƯỜNG DẪN LIÊN KẾT (URL)</label>
                    <input
                      type="text"
                      value={discordUrl}
                      onChange={(e) => setDiscordUrl(e.target.value)}
                      placeholder="https://discord.gg/..."
                      className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2.5 px-3 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-400 mb-1">MÔ TẢ NGẮN GỌN</label>
                  <input
                    type="text"
                    value={discordDesc}
                    onChange={(e) => setDiscordDesc(e.target.value)}
                    placeholder="Mô tả về server Discord..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2.5 px-3 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* FACEBOOK CONFIG */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
                    <h4 className="font-bold text-sm text-white uppercase tracking-wider">Group Facebook</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFacebookActive(!facebookActive)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-xl border-2 border-slate-950 shadow-[1.5px_1.5px_0px_0px_rgba(255,255,255,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all cursor-pointer flex items-center gap-1.5 ${
                      facebookActive 
                        ? "bg-emerald-400 text-slate-950" 
                        : "bg-slate-800 text-slate-400 border-slate-700 shadow-none"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${facebookActive ? "bg-slate-950 animate-ping" : "bg-slate-500"}`} />
                    {facebookActive ? "Đang Bật (Hiển thị)" : "Đang Tắt (Ẩn đi)"}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-400 mb-1">TÊN HIỂN THỊ (Mặc định: Group Facebook Săn Học Bổng)</label>
                    <input
                      type="text"
                      value={facebookTitle}
                      onChange={(e) => setFacebookTitle(e.target.value)}
                      placeholder="Group Facebook Săn Học Bổng"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2.5 px-3 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-slate-400 mb-1">ĐƯỜNG DẪN LIÊN KẾT (URL)</label>
                    <input
                      type="text"
                      value={facebookUrl}
                      onChange={(e) => setFacebookUrl(e.target.value)}
                      placeholder="https://facebook.com/groups/..."
                      className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2.5 px-3 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-400 mb-1">MÔ TẢ NGẮN GỌN</label>
                  <input
                    type="text"
                    value={facebookDesc}
                    onChange={(e) => setFacebookDesc(e.target.value)}
                    placeholder="Mô tả về group Facebook..."
                    className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 text-white text-xs py-2.5 px-3 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-rose-500 hover:bg-rose-600 disabled:bg-rose-500/50 text-white font-bold text-sm py-3 px-8 rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:pointer-events-none"
                >
                  {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4.5 w-4.5" />}
                  Lưu & Đồng bộ hệ thống
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative max-w-md w-full z-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-indigo-500" />
              
              <div className="flex items-start gap-4 mt-2">
                <div className={`p-3 rounded-2xl ${confirmModal.isDanger ? "bg-rose-500/10 text-rose-400" : "bg-indigo-500/10 text-indigo-400"}`}>
                  {confirmModal.isDanger ? <AlertTriangle className="h-6 w-6" /> : <Info className="h-6 w-6" />}
                </div>
                
                <div className="flex-1">
                  <h4 className="text-base font-bold text-white font-sans">{confirmModal.title}</h4>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">{confirmModal.message}</p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer"
                >
                  {confirmModal.cancelText || "Hủy"}
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className={`font-bold text-xs py-2.5 px-5 rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1 ${
                    confirmModal.isDanger 
                      ? "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/10" 
                      : "bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-500/10"
                  }`}
                >
                  {confirmModal.confirmText || "Xác nhận"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Notification Toast */}
      <AnimatePresence>
        {toast.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex items-center gap-3.5 overflow-hidden"
          >
            <div className={`p-2 rounded-xl ${
              toast.type === "success" ? "bg-emerald-500/10 text-emerald-400" :
              toast.type === "error" ? "bg-rose-500/10 text-rose-400" :
              "bg-indigo-500/10 text-indigo-400"
            }`}>
              {toast.type === "success" && <CheckCircle2 className="h-5 w-5" />}
              {toast.type === "error" && <XCircle className="h-5 w-5" />}
              {toast.type === "info" && <Info className="h-5 w-5" />}
            </div>
            
            <div className="flex-1 text-xs font-medium text-slate-200">
              {toast.message}
            </div>

            <button
              onClick={() => setToast(prev => ({ ...prev, isOpen: false }))}
              className="p-1 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
