import React, { useState, useEffect, useRef } from "react";
import { AppUser, Group, GroupDailyStatus, GroupMemberStatus, Subject, Message } from "../types";
import {
  createGroup,
  joinGroup,
  subscribeToGroup,
  subscribeToDailyStatus,
  evaluateGroupStreak,
  restoreGroupStreak,
  getRestoreTokensForStreak
} from "../services/groupService";
import { subscribeToSubjects } from "../services/flashcardService";
import { getVNDateString, getVNTimeUntilMidnight } from "../utils/timezone";
import { doc, getDoc, updateDoc, arrayRemove, collection, query, orderBy, limit, addDoc, serverTimestamp, onSnapshot, deleteDoc, deleteField, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { motion, AnimatePresence } from "motion/react";
import { CreateOrJoinGroup } from "./CreateOrJoinGroup";
import {
  Users,
  Plus,
  ArrowRight,
  Clipboard,
  Flame,
  Award,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Shield,
  LifeBuoy,
  ChevronRight,
  LogOut,
  AlertTriangle,
  RefreshCw,
  Share2,
  MessageSquare,
  Send,
  X,
  CornerUpLeft,
  Undo2,
  Trash2,
  ShieldAlert,
  Smile
} from "lucide-react";
import { LocalDB } from "../utils/localDb";

interface GroupStreakProps {
  user: AppUser;
}

export default function GroupStreak({ user }: GroupStreakProps) {
  // Setup Group UI State
  const [groupIdInput, setGroupIdInput] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [loadingAction, setLoadingAction] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Sub-tabs state inside Group Streak workspace
  const [subTab, setSubTab] = useState<"progress" | "chat">("progress");

  // Group chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<string | null>(null);

  const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Subjects state for group creation
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  // Load active subjects
  useEffect(() => {
    const unsubscribe = subscribeToSubjects((allSubjects) => {
      setSubjects(allSubjects.filter(s => s.isActive));
    });
    return () => unsubscribe();
  }, []);

  // Loaded Group states
  const [group, setGroup] = useState<Group | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [dailyStatus, setDailyStatus] = useState<GroupDailyStatus | null>(null);
  const [todayStr] = useState(() => getVNDateString());
  const [timeRemaining, setTimeRemaining] = useState(() => getVNTimeUntilMidnight());

  // Streak Evaluation Feedback
  const [evaluationResult, setEvaluationResult] = useState<string | null>(null);

  // Milestone Celebration Overlay State
  const [showMilestoneOverlay, setShowMilestoneOverlay] = useState(false);
  const [celebratedMilestone, setCelebratedMilestone] = useState<number | null>(null);

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
    confirmText?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Track time remaining until VN midnight
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(getVNTimeUntilMidnight());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showMobileList, setShowMobileList] = useState(false);

  // Compute unique joined group IDs
  const currentGroupIds = React.useMemo(() => {
    const ids = user.groupIds || (user.groupId ? [user.groupId] : []);
    return Array.from(new Set(ids));
  }, [user.groupIds, user.groupId]);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
    const saved = localStorage.getItem(`active_group_id_${user.uid}`);
    if (saved && currentGroupIds.includes(saved)) return saved;
    return currentGroupIds.length > 0 ? currentGroupIds[0] : null;
  });

  const getSubjectName = (subId: string) => {
    return subjects.find((s) => s.id === subId)?.name || "Môn học";
  };

  // Track and synchronize activeGroupId with user's groups
  useEffect(() => {
    if (activeGroupId && !currentGroupIds.includes(activeGroupId)) {
      setActiveGroupId(currentGroupIds.length > 0 ? currentGroupIds[0] : null);
    }
  }, [currentGroupIds, activeGroupId]);

  // Save activeGroupId to localStorage
  useEffect(() => {
    if (activeGroupId) {
      localStorage.setItem(`active_group_id_${user.uid}`, activeGroupId);
    } else {
      localStorage.removeItem(`active_group_id_${user.uid}`);
    }
  }, [activeGroupId, user.uid]);

  // Subscribe to all groups the user is in
  useEffect(() => {
    if (currentGroupIds.length === 0) {
      setJoinedGroups([]);
      setLoadingGroups(false);
      return;
    }

    setLoadingGroups(true);
    const unsubscribes = currentGroupIds.map((gId) => {
      const groupRef = doc(db, "groups", gId);
      return onSnapshot(groupRef, (docSnap) => {
        if (docSnap.exists()) {
          const g = { id: docSnap.id, ...docSnap.data() } as Group;
          LocalDB.saveGroup(g);
          setJoinedGroups((prev) => {
            const filtered = prev.filter((item) => item.id !== g.id);
            const updated = [...filtered, g];
            return currentGroupIds
              .map((id) => updated.find((item) => item.id === id))
              .filter((item): item is Group => !!item);
          });
        }
      }, (error) => {
        console.warn(`Error subscribing to group ${gId}:`, error);
      });
    });

    setLoadingGroups(false);

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [currentGroupIds]);

  // Fetch Group and Daily Status once activeGroupId is updated
  useEffect(() => {
    if (!activeGroupId) {
      setGroup(null);
      setLoadingGroup(false);
      return;
    }

    setLoadingGroup(true);
    // Listen to group real-time
    const unsubscribeGroup = subscribeToGroup(activeGroupId, async (loadedGroup) => {
      setGroup(loadedGroup);
      setLoadingGroup(false);

      if (loadedGroup) {
        // Run automatic yesterday streak checker
        try {
          const result = await evaluateGroupStreak(loadedGroup.id, loadedGroup.memberIds);
          if (result.streakUpdated) {
            setEvaluationResult(result.statusChanged);
          }
        } catch (error) {
          console.error("Lỗi đánh giá chuỗi ngày:", error);
        }
      }
    });

    // Listen to daily status for today real-time
    const unsubscribeDaily = subscribeToDailyStatus(activeGroupId, todayStr, (status) => {
      setDailyStatus(status);
    });

    return () => {
      unsubscribeGroup();
      unsubscribeDaily();
    };
  }, [activeGroupId, todayStr]);

  // Check if current streak hits a milestone for celebration
  useEffect(() => {
    if (group && group.currentStreak > 0) {
      const milestones = [5, 10, 20, 50, 100, 150, 200, 400];
      if (milestones.includes(group.currentStreak)) {
        // Prevent repeating overlay if already closed
        const sessionKey = `celebrated_streak_${group.id}_${group.currentStreak}`;
        if (!sessionStorage.getItem(sessionKey)) {
          setCelebratedMilestone(group.currentStreak);
          setShowMilestoneOverlay(true);
          sessionStorage.setItem(sessionKey, "true");
        }
      }
    }
  }, [group?.currentStreak, group?.id]);

  // Subscribe to real-time group chat messages
  useEffect(() => {
    if (!group || subTab !== "chat") return;

    setLoadingChat(true);
    const messagesCol = collection(db, "groups", group.id, "messages");
    const q = query(messagesCol, orderBy("createdAt", "desc"), limit(40));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data({ serverTimestamps: "estimate" }) } as Message);
      });
      const reversed = list.reverse();
      setMessages(reversed);
      setLoadingChat(false);
    }, (error) => {
      console.warn("Firestore group chat subscriber error:", error);
      setLoadingChat(false);
    });

    return () => unsubscribe();
  }, [group?.id, subTab]);

  // Auto scroll group messages to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatBottomRef.current) {
        chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 50);
  };

  useEffect(() => {
    if (subTab === "chat" && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, subTab]);

  const handleRecallGroupMessage = (messageId: string) => {
    if (!group) return;
    if (messageId.startsWith("gmsg_temp_")) return;
    
    setConfirmModal({
      isOpen: true,
      title: "Thu hồi tin nhắn ↩️",
      message: "Bạn có chắc chắn muốn thu hồi tin nhắn này? Hành động này sẽ được đồng bộ ngay lập tức với các học viên khác.",
      isDanger: true,
      confirmText: "Thu hồi",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const msgRef = doc(db, "groups", group.id, "messages", messageId);
          await updateDoc(msgRef, { recalled: true });
        } catch (err) {
          console.error("Lỗi khi thu hồi tin nhắn nhóm:", err);
        }
      }
    });
  };

  const handleDeleteGroupMessage = (messageId: string) => {
    if (!group) return;
    if (messageId.startsWith("gmsg_temp_")) return;
    
    setConfirmModal({
      isOpen: true,
      title: "Xóa tin nhắn (Admin) 🛡️",
      message: "Bạn là Quản trị viên. Bạn có chắc chắn muốn xóa vĩnh viễn tin nhắn này? Tin nhắn sẽ bị ẩn trên thiết bị của mọi học viên.",
      isDanger: true,
      confirmText: "Xóa tin nhắn",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const msgRef = doc(db, "groups", group.id, "messages", messageId);
          await updateDoc(msgRef, { deletedByAdmin: true });
        } catch (err) {
          console.error("Lỗi khi xóa tin nhắn nhóm:", err);
        }
      }
    });
  };

  const handleToggleGroupReaction = async (messageId: string, emoji: string) => {
    if (!group) return;
    if (messageId.startsWith("gmsg_temp_")) return;
    
    try {
      const msgRef = doc(db, "groups", group.id, "messages", messageId);
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(msgRef);
        if (!sfDoc.exists()) return;
        
        const data = sfDoc.data() as Message;
        const reactions = data.reactions || {};
        const currentUids = reactions[emoji] || [];
        
        let updatedUids: string[];
        if (currentUids.includes(user.uid)) {
          updatedUids = currentUids.filter(id => id !== user.uid);
        } else {
          updatedUids = [...currentUids, user.uid];
        }
        
        const newReactions = {
          ...reactions,
          [emoji]: updatedUids
        };
        
        transaction.update(msgRef, { reactions: newReactions });
      });
    } catch (err) {
      console.error("Lỗi khi cập nhật cảm xúc tin nhắn nhóm:", err);
    }
  };

  const handleSendGroupMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    const cleanText = inputText.trim();
    if (!cleanText) return;

    setInputText("");
    setIsSending(true);

    const replyToData = replyToMessage ? {
      id: replyToMessage.id,
      displayName: replyToMessage.displayName,
      text: replyToMessage.recalled || replyToMessage.deletedByAdmin ? "Tin nhắn đã bị thu hồi" : replyToMessage.text
    } : null;

    const tempMsg: Message = {
      id: `gmsg_temp_${Date.now()}`,
      uid: user.uid,
      displayName: user.displayName,
      text: cleanText,
      avatarUrl: user.avatarUrl || null,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
      role: user.role,
      replyTo: replyToData
    };

    setReplyToMessage(null);

    setMessages((prev) => [...prev, tempMsg]);
    scrollToBottom();

    try {
      const messagesCol = collection(db, "groups", group.id, "messages");
      await addDoc(messagesCol, {
        uid: user.uid,
        displayName: user.displayName,
        text: cleanText,
        avatarUrl: user.avatarUrl || null,
        createdAt: serverTimestamp(),
        role: user.role,
        replyTo: replyToData
      });
    } catch (error) {
      console.warn("Firestore send group message failed:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setErrorMessage("Vui lòng nhập tên nhóm muốn tạo!");
      return;
    }
    if (!selectedSubjectId) {
      setErrorMessage("Vui lòng chọn môn học cho nhóm!");
      return;
    }

    setLoadingAction(true);
    setErrorMessage("");
    try {
      const gId = await createGroup(newGroupName.trim(), selectedSubjectId, user.uid, user.displayName, user.email);
      setSuccessMessage(`Đã tạo thành công nhóm "${newGroupName.trim()}"!`);
      setNewGroupName("");
      setSelectedSubjectId("");
      setActiveGroupId(gId);
      setShowMobileList(false);
    } catch (error: any) {
      setErrorMessage(error.message || "Không thể tạo nhóm. Vui lòng thử lại!");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = groupIdInput.trim();
    if (!cleanId) {
      setErrorMessage("Vui lòng nhập mã ID nhóm!");
      return;
    }

    setLoadingAction(true);
    setErrorMessage("");
    try {
      await joinGroup(cleanId, user.uid, user.displayName, user.email);
      setSuccessMessage("Bạn đã tham gia nhóm thành công!");
      setGroupIdInput("");
      setActiveGroupId(cleanId);
      setShowMobileList(false);
    } catch (error: any) {
      setErrorMessage(error.message || "Mã nhóm không hợp lệ hoặc nhóm đã đầy.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleCopyGroupId = () => {
    if (group) {
      navigator.clipboard.writeText(group.id);
      setSuccessMessage("Đã sao chép mã ID Nhóm! Bạn có thể gửi mã này cho bạn bè học chung.");
    }
  };

  const triggerLeaveGroup = () => {
    if (!group) return;
    setConfirmModal({
      isOpen: true,
      title: "Rời khỏi nhóm học tập",
      message: "Bạn có chắc chắn muốn rời khỏi nhóm này không? Tiến trình giữ chuỗi nhóm của bạn sẽ bị gỡ bỏ.",
      isDanger: true,
      confirmText: "Rời khỏi nhóm",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await executeLeaveGroup();
      }
    });
  };

  const executeLeaveGroup = async () => {
    if (!group) return;

    setLoadingAction(true);
    try {
      const groupRef = doc(db, "groups", group.id);
      const userRef = doc(db, "users", user.uid);

      // Determine remaining members
      const remainingMembers = group.memberIds.filter(mId => mId !== user.uid);

      if (remainingMembers.length === 0) {
        // If no members are left, delete the group completely to keep database clean
        await deleteDoc(groupRef);
      } else {
        // Otherwise update the group's member list and potential new owner
        const newOwnerId = group.ownerId === user.uid ? remainingMembers[0] : group.ownerId;
        await updateDoc(groupRef, {
          memberIds: remainingMembers,
          ownerId: newOwnerId
        });
      }

      // Clear groupId and remove from groupIds in user Firestore doc
      await updateDoc(userRef, {
        groupId: null,
        groupIds: arrayRemove(group.id)
      });

      // Remove user profile from dailyStatus cleanly using deleteField()
      const todayStatusRef = doc(db, `groups/${group.id}/dailyStatus`, todayStr);
      const todayStatusSnap = await getDoc(todayStatusRef);
      if (todayStatusSnap.exists()) {
        await updateDoc(todayStatusRef, {
          [`memberProgress.${user.uid}`]: deleteField()
        });
      }

      // Update LocalDB and localStorage to keep offline and reactive state synchronized
      const localUser = LocalDB.getUser(user.uid);
      if (localUser) {
        localUser.groupId = null;
        localUser.groupIds = localUser.groupIds ? localUser.groupIds.filter(id => id !== group.id) : [];
        LocalDB.saveUser(localUser);
      }

      const customUserStr = localStorage.getItem("custom_auth_user");
      if (customUserStr) {
        try {
          const customUserObj = JSON.parse(customUserStr) as AppUser;
          if (customUserObj.uid === user.uid) {
            customUserObj.groupId = null;
            customUserObj.groupIds = customUserObj.groupIds ? customUserObj.groupIds.filter(id => id !== group.id) : [];
            localStorage.setItem("custom_auth_user", JSON.stringify(customUserObj));
          }
        } catch (e) {
          console.warn(e);
        }
      }

      window.dispatchEvent(new Event("storage"));
      setSuccessMessage("Bạn đã rời khỏi nhóm học tập thành công.");
      const remainingGroupIds = currentGroupIds.filter((id) => id !== group.id);
      setActiveGroupId(remainingGroupIds.length > 0 ? remainingGroupIds[0] : null);
      setShowMobileList(remainingGroupIds.length > 0 ? false : true);
    } catch (error: any) {
      setErrorMessage(error.message || "Lỗi khi rời nhóm.");
    } finally {
      setLoadingAction(false);
    }
  };

  const triggerRestoreStreak = () => {
    if (!group) return;
    setConfirmModal({
      isOpen: true,
      title: "Khôi phục chuỗi ngày học",
      message: `Bạn có muốn sử dụng 1 lượt khôi phục để khôi phục lại chuỗi ngày không? Bạn còn ${group.restoreTokensAvailable} lượt.`,
      isDanger: false,
      confirmText: "Khôi phục chuỗi",
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await executeRestoreStreak();
      }
    });
  };

  const executeRestoreStreak = async () => {
    if (!group) return;

    setLoadingAction(true);
    try {
      await restoreGroupStreak(group.id);
      setSuccessMessage("Khôi phục chuỗi thành công! Chuỗi ngày học của bạn đã được cứu vớt! 🎉");
    } catch (error: any) {
      setErrorMessage(error.message || "Lỗi khi khôi phục chuỗi.");
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="max-w-[95%] xl:max-w-[92%] 2xl:max-w-[1550px] mx-auto px-4 sm:px-6 py-8 relative">
      {/* Messages */}
      {errorMessage && (
        <div className="mb-6 bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-xl flex items-center justify-between text-sm">
          <p>{errorMessage}</p>
          <button onClick={() => setErrorMessage("")} className="font-bold cursor-pointer">×</button>
        </div>
      )}
      {successMessage && (
        <div className="mb-6 bg-emerald-50 border border-emerald-100 text-emerald-600 p-4 rounded-xl flex items-center justify-between text-sm">
          <p>{successMessage}</p>
          <button onClick={() => setSuccessMessage("")} className="font-bold cursor-pointer">×</button>
        </div>
      )}

      {/* Messenger-style Multi-Group Navigation Layout */}
      <div className="flex flex-col lg:flex-row gap-6 bg-slate-50/20 rounded-3xl overflow-hidden border border-slate-200 shadow-sm min-h-[600px]">
        
        {/* LEFT COLUMN: Sidebar (Group list switcher) */}
        <div className={`w-full lg:w-[360px] border-r border-slate-200 bg-white/80 backdrop-blur-md flex flex-col shrink-0 ${
          showMobileList ? "flex" : "hidden lg:flex"
        }`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-orange-50/40">
            <div>
              <h3 className="font-extrabold text-slate-950 text-sm font-sans tracking-tight">
                Nhóm học tập
              </h3>
              <p className="text-[10px] text-orange-600 font-bold">Giữ chuỗi liên tục</p>
            </div>
            <button
              onClick={() => {
                setActiveGroupId(null);
                setShowMobileList(false);
              }}
              className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl transition-all cursor-pointer border border-orange-100"
              title="Tạo hoặc tham gia nhóm mới"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable list of joined groups */}
          <div className="p-3 overflow-y-auto flex-grow space-y-3 max-h-[500px] lg:max-h-[600px]">
            {loadingGroups ? (
              <div className="p-4 text-center text-xs text-slate-400 font-mono animate-pulse">
                Đang tải danh sách nhóm...
              </div>
            ) : joinedGroups.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 leading-relaxed font-sans">
                Chưa tham gia nhóm nào. Hãy ấn nút <strong className="text-orange-600 font-black">+</strong> để tạo hoặc tham gia!
              </div>
            ) : (
              joinedGroups.map((g) => {
                const isActive = g.id === activeGroupId;
                const subName = getSubjectName(g.subjectId);
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setActiveGroupId(g.id);
                      setShowMobileList(false);
                    }}
                    className={`w-full text-left p-4 rounded-2xl transition-all flex items-center justify-between border cursor-pointer ${
                      isActive
                        ? "bg-gradient-to-br from-orange-500 via-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/20 border-transparent scale-[1.02] -translate-y-0.5"
                        : "bg-white hover:bg-orange-50/30 text-slate-800 border-slate-200 hover:border-orange-300 shadow-sm hover:scale-[1.01] hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="min-w-0 flex-grow pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-black font-sans tracking-wider py-0.5 px-2 rounded-lg uppercase border ${
                          isActive
                            ? "bg-white/20 text-white border-white/30"
                            : "bg-orange-50 text-orange-600 border-orange-100"
                        }`}>
                          {subName}
                        </span>
                        <span className={`text-[10px] font-mono font-bold ${isActive ? "text-orange-100" : "text-slate-400"}`}>
                          ID: {g.id}
                        </span>
                      </div>
                      <h4 className={`text-base sm:text-lg md:text-xl font-black truncate font-sans tracking-tight mt-2 ${
                        isActive ? "text-white" : "text-slate-950"
                      }`}>
                        {g.name}
                      </h4>
                    </div>

                    <div className="shrink-0 text-right flex flex-col items-end gap-1">
                      <div className="flex items-center gap-0.5 text-base sm:text-lg font-black">
                        <span>🔥</span>
                        <span className={isActive ? "text-yellow-300" : "text-orange-600"}>
                          {g.currentStreak}
                        </span>
                      </div>
                      <div className={`text-[11px] font-bold flex items-center gap-0.5 ${
                        isActive ? "text-orange-100" : "text-slate-500"
                      }`}>
                        <span>👥</span>
                        <span>{g.memberIds.length}/10</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active viewport */}
        <div className={`flex-grow p-4 sm:p-6 lg:p-8 flex flex-col bg-white/30 ${
          showMobileList ? "hidden lg:flex" : "flex"
        }`}>
          {/* Mobile switcher back bar */}
          {joinedGroups.length > 0 && (
            <div className="lg:hidden flex items-center mb-4">
              <button
                onClick={() => setShowMobileList(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-100 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
              >
                ← Quay lại danh sách nhóm ({joinedGroups.length})
              </button>
            </div>
          )}

          {/* Dynamic Content depending on whether group is loaded */}
          {!group ? (
        <CreateOrJoinGroup
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          setSelectedSubjectId={setSelectedSubjectId}
          newGroupName={newGroupName}
          setNewGroupName={setNewGroupName}
          groupIdInput={groupIdInput}
          setGroupIdInput={setGroupIdInput}
          handleCreateGroup={handleCreateGroup}
          handleJoinGroup={handleJoinGroup}
          loadingAction={loadingAction}
        />
      ) : (
        /* RENDER VIEW 2: USER IS ACTIVELY IN A GROUP */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Dashboard Panel (Left/Center 2 Cols) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Group Header Info */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="bg-indigo-50 text-indigo-600 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-100">
                      NHÓM HỌC TẬP
                    </span>
                    <span className="text-slate-500 text-xs font-sans font-semibold">
                      {group.memberIds.length}/10 thành viên
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-sans font-extrabold text-slate-900 tracking-tight">
                    {group.name}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-left">
                    <span className="block text-[9px] text-slate-500 font-bold font-sans">MÃ ID CHIA SẺ</span>
                    <span className="font-mono text-xs text-indigo-600 font-semibold select-all mr-2">{group.id}</span>
                  </div>
                  <button
                    onClick={handleCopyGroupId}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-200 cursor-pointer"
                    title="Sao chép ID nhóm để chia sẻ"
                  >
                    <Clipboard className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap gap-4 items-center justify-between text-xs font-sans text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-600 animate-pulse" />
                  <span>Cập nhật ngày tiếp theo sau: <strong className="text-slate-800 font-bold">{String(timeRemaining.hours).padStart(2, "0")}:{String(timeRemaining.minutes).padStart(2, "0")}:{String(timeRemaining.seconds).padStart(2, "0")}</strong></span>
                </div>
                <button
                  onClick={triggerLeaveGroup}
                  disabled={loadingAction}
                  className="text-slate-500 hover:text-rose-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" /> Rời khỏi nhóm
                </button>
              </div>
            </div>

            {/* Segmented Sub-Tabs Toggle */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full sm:w-80">
              <button
                onClick={() => setSubTab("progress")}
                className={`flex-1 text-center py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  subTab === "progress"
                    ? "bg-white text-slate-900 border border-slate-200 shadow-sm font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Tiến Độ Đồng Đội
              </button>
              <button
                onClick={() => setSubTab("chat")}
                className={`flex-1 text-center py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  subTab === "chat"
                    ? "bg-white text-slate-900 border border-slate-200 shadow-sm font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Trò Chuyện Nhóm 💬
              </button>
            </div>

            {subTab === "progress" ? (
              <>
                {/* Streak Recovery Warning Overlay if broken */}
                {group.currentStreak === 0 && dailyStatus && !dailyStatus.isGroupCompleted && (
                  <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full filter blur-xl pointer-events-none" />
                    
                    <div className="flex items-start gap-4">
                      <div className="bg-amber-100 border border-amber-200 text-amber-700 p-3 rounded-2xl shrink-0 mt-1">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-slate-950 font-sans font-extrabold text-lg mb-1">Cảnh báo: Đứt Chuỗi Ngày Học! 😢</h4>
                        <p className="text-sm text-slate-600 leading-relaxed max-w-lg">
                          Ngày hôm qua nhóm của bạn đã có thành viên chưa hoàn thành 100% mục tiêu học bài, khiến chuỗi streak tạm thời bị reset về 0.
                        </p>
                        {group.restoreTokensAvailable > 0 ? (
                          <p className="text-xs text-amber-700 font-bold font-sans mt-2">
                            Nhóm đang có {group.restoreTokensAvailable} lượt khôi phục khả dụng! Bạn có thể sử dụng ngay để nối lại chuỗi.
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 font-sans font-medium mt-2">
                            Nhóm của bạn không còn lượt khôi phục chuỗi nào. Hãy nỗ lực học tập để đạt mốc 10 ngày đầu tiên và nhận thêm lượt!
                          </p>
                        )}
                      </div>
                    </div>

                    {group.restoreTokensAvailable > 0 && (
                      <button
                        onClick={triggerRestoreStreak}
                        disabled={loadingAction}
                        className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm py-3 px-6 rounded-2xl flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer"
                      >
                        <LifeBuoy className="h-4.5 w-4.5 animate-spin-slow" /> Dùng Lượt Khôi Phục
                      </button>
                    )}
                  </div>
                )}

                {/* Team Members Study Progress list */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-sans font-bold text-lg text-slate-900">Bảng Tiến Độ Đồng Đội Hôm Ngay</h3>
                      <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                        Đồng bộ thời gian thực từ Firestore. Nhắc nhở nhau học 100% để giữ chuỗi!
                      </p>
                    </div>

                    {dailyStatus?.isGroupCompleted ? (
                      <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-bold font-sans py-1.5 px-3 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5 fill-emerald-500/10" /> CẢ NHÓM ĐÃ XONG
                      </span>
                    ) : (
                      <span className="bg-amber-50 text-amber-600 border border-amber-100 text-xs font-bold font-sans py-1.5 px-3 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 animate-pulse" /> ĐANG CHỜ ÔN TẬP
                      </span>
                    )}
                  </div>

                  {/* Members List */}
                  <div className="space-y-4">
                    {group.memberIds.map((mId) => {
                      // Get progress details from today's daily status
                      const mProgress = dailyStatus?.memberProgress?.[mId];
                      const displayName = mProgress?.displayName || (mId === user.uid ? user.displayName : "Đang tải...");
                      const email = mProgress?.email || (mId === user.uid ? user.email : "");
                      const isCompleted = mProgress?.isCompleted || false;
                      const completedPercent = mProgress?.completedPercent || 0;

                      return (
                        <div
                          key={mId}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all ${
                            isCompleted
                              ? "border-emerald-200 bg-emerald-50/20"
                              : "border-slate-200 bg-slate-50/40"
                          }`}
                        >
                          {/* Name info */}
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${isCompleted ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                              <Users className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900">{displayName}</span>
                                {mId === user.uid && (
                                  <span className="bg-indigo-50 text-indigo-600 text-[9px] font-bold font-sans tracking-wide py-0.5 px-1.5 rounded-full border border-indigo-100 uppercase">
                                    Bạn
                                  </span>
                                )}
                                {mId === group.ownerId && (
                                  <span className="bg-amber-50 text-amber-700 text-[9px] font-bold font-sans tracking-wide py-0.5 px-1.5 rounded-full border border-amber-100 uppercase flex items-center gap-0.5">
                                    <Shield className="h-2.5 w-2.5" /> Trưởng nhóm
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-sans block">{email}</span>
                            </div>
                          </div>

                          {/* Progress bar / Tick */}
                          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                            <div className="text-right flex-grow sm:flex-grow-0 sm:min-w-[140px]">
                              <div className="flex items-center justify-between text-xs font-sans mb-1">
                                <span className={isCompleted ? "text-emerald-600 font-bold" : "text-slate-500 font-semibold"}>
                                  {isCompleted ? "Hoàn thành 100%" : "Đang học"}
                                </span>
                                <span className="text-slate-500 font-bold">{completedPercent}%</span>
                              </div>
                              <div className="h-1.5 w-full sm:w-36 bg-slate-100 border border-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${isCompleted ? "bg-emerald-500" : "bg-indigo-600"}`}
                                  style={{ width: `${completedPercent}%` }}
                                />
                              </div>
                            </div>

                            {isCompleted ? (
                              <div className="p-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full shrink-0">
                                <CheckCircle className="h-5 w-5" />
                              </div>
                            ) : (
                              <div className="p-1.5 bg-slate-100 border border-slate-200 text-slate-400 rounded-full shrink-0">
                                <XCircle className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mini Instruction */}
                  {group.memberIds.length < 2 && (
                    <div className="mt-6 bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
                      <div>
                        <h5 className="text-sm font-bold text-slate-900 mb-0.5">Đang chờ bạn đồng hành</h5>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Để tính chuỗi streak nhóm hoạt động, nhóm cần có <strong>tối thiểu 2 thành viên</strong>. Hãy copy mã ID nhóm ở đầu trang và gửi cho bạn bè ôn tập cùng nhé!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col h-[520px] justify-between">
                {/* Chat Header */}
                <div className="bg-indigo-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
                      <MessageSquare className="h-4.5 w-4.5 text-indigo-600" /> Trò Chuyện Đồng Đội
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">Tin nhắn tự động đồng bộ tức thì cho tất cả thành viên</p>
                  </div>
                  <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full animate-pulse" title="Trực tuyến" />
                </div>

                {/* Messages Panel */}
                <div
                  ref={chatContainerRef}
                  className="p-4 sm:p-6 overflow-y-auto flex-grow space-y-4 bg-slate-50/30"
                >
                  {loadingChat ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs font-bold uppercase">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mb-2" />
                      Đang tải tin nhắn...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-4">
                      <MessageSquare className="h-10 w-10 text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-700 uppercase">Phòng chat nhóm chưa có tin nhắn</p>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-xs">Gửi tin nhắn chào đồng đội hoặc nhắc nhở nhau học từ vựng hôm nay nhé!</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.uid === user.uid;
                      const isRecalled = msg.recalled;
                      const isDeleted = msg.deletedByAdmin;
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[85%] mb-2 ${isMe ? "ml-auto items-end" : "mr-auto items-start"} group relative`}
                        >
                          {/* Quoted Message (Reply) Header */}
                          {msg.replyTo && !isRecalled && !isDeleted && (
                            <div className={`flex items-center gap-1.5 text-[10px] text-slate-500 font-bold mb-1 max-w-full opacity-80 shrink-0 ${isMe ? "justify-end mr-10" : "justify-start ml-10"}`}>
                              <CornerUpLeft className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate bg-slate-200/60 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                                Trả lời <strong className="text-slate-900">@{msg.replyTo.displayName}</strong>: {msg.replyTo.text}
                              </span>
                            </div>
                          )}

                          <div className={`flex items-start gap-2 w-full ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                            <div className={`w-8 h-8 rounded-full bg-indigo-100 border border-indigo-250 flex items-center justify-center font-black text-xs text-indigo-800 shrink-0`}>
                              {msg.displayName ? msg.displayName.charAt(0).toUpperCase() : "?"}
                            </div>

                            <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                              <span className="text-[10px] text-slate-500 font-bold mb-0.5 px-1">{msg.displayName}</span>
                              
                              {/* Message bubble depending on state */}
                              {isRecalled ? (
                                <div className="p-3 rounded-2xl text-xs sm:text-sm leading-relaxed border border-dashed border-slate-300 bg-slate-150 text-slate-400 font-semibold italic shadow-inner rounded-tr-none">
                                  Tin nhắn đã bị thu hồi ↩️
                                </div>
                              ) : isDeleted ? (
                                <div className="p-3 rounded-2xl text-xs sm:text-sm leading-relaxed border border-dashed border-red-200 bg-red-50 text-red-400 font-semibold flex items-center gap-1.5 shadow-inner rounded-tl-none">
                                  <ShieldAlert className="h-3.5 w-3.5 stroke-[2.5]" /> Tin nhắn đã bị quản trị viên xóa 🛡️
                                </div>
                              ) : (
                                <div
                                  className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed border shadow-sm break-words ${
                                    isMe
                                      ? "bg-indigo-600 text-white border-indigo-750 rounded-tr-none"
                                      : "bg-white text-slate-900 border-slate-200 rounded-tl-none"
                                  }`}
                                >
                                  {msg.text}
                                </div>
                              )}

                              {/* Render active reactions */}
                              {msg.reactions && Object.keys(msg.reactions).some(emoji => (msg.reactions as any)[emoji]?.length > 0) && (
                                <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? "justify-end" : "justify-start"}`}>
                                  {Object.entries(msg.reactions as { [key: string]: string[] }).map(([emoji, uids]) => {
                                    if (!uids || uids.length === 0) return null;
                                    const hasReacted = uids.includes(user.uid);
                                    return (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleToggleGroupReaction(msg.id, emoji)}
                                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-black border-2 transition-all cursor-pointer shadow-[1px_1px_0px_0px_rgba(2,6,23,1)] hover:scale-105 active:scale-95 ${
                                          hasReacted 
                                            ? "bg-indigo-100 border-indigo-600 text-indigo-900" 
                                            : "bg-white border-slate-950 text-slate-800"
                                        }`}
                                        title={hasReacted ? "Bỏ cảm xúc này" : "Bày tỏ cảm xúc này"}
                                      >
                                        <span>{emoji}</span>
                                        <span className="text-[10px] font-black">{uids.length}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* Action items underneath */}
                              {!isRecalled && !isDeleted && (
                                <div className="flex items-center gap-1.5 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-150">
                                  <button
                                    type="button"
                                    onClick={() => setReplyToMessage(msg)}
                                    className="p-1 hover:bg-slate-200 border border-transparent rounded-lg text-slate-500 transition-all cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                                    title="Phản hồi"
                                  >
                                    <CornerUpLeft className="h-3 w-3" /> Phản hồi
                                  </button>

                                  {/* Emoji reaction picker button */}
                                  {!msg.id.startsWith("gmsg_temp_") && (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setActiveEmojiPicker(activeEmojiPicker === msg.id ? null : msg.id)}
                                        className={`p-1 border border-transparent rounded-lg text-slate-500 transition-all cursor-pointer flex items-center gap-0.5 text-[10px] font-bold ${
                                          activeEmojiPicker === msg.id 
                                            ? "bg-indigo-50 border-slate-950 text-indigo-700" 
                                            : "hover:bg-slate-200"
                                        }`}
                                        title="Thả cảm xúc"
                                      >
                                        <Smile className="h-3.5 w-3.5" /> Cảm xúc
                                      </button>

                                      {activeEmojiPicker === msg.id && (
                                        <div className={`absolute z-10 bottom-full mb-1 flex items-center gap-1 bg-white border-2 border-slate-950 p-1.5 rounded-xl shadow-[3px_3px_0px_0px_rgba(2,6,23,1)] ${isMe ? "right-0" : "left-0"}`}>
                                          {EMOJI_OPTIONS.map((emoji) => {
                                            const uids = (msg.reactions as any)?.[emoji] || [];
                                            const hasReacted = uids.includes(user.uid);
                                            return (
                                              <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => {
                                                  handleToggleGroupReaction(msg.id, emoji);
                                                  setActiveEmojiPicker(null);
                                                }}
                                                className={`text-base p-1 hover:bg-indigo-50 rounded-lg active:scale-90 transition-all cursor-pointer ${
                                                  hasReacted ? "bg-indigo-50 scale-110" : ""
                                                }`}
                                              >
                                                {emoji}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {isMe && !msg.id.startsWith("gmsg_temp_") && (
                                    <button
                                      type="button"
                                      onClick={() => handleRecallGroupMessage(msg.id)}
                                      className="p-1 hover:bg-amber-50 hover:text-amber-700 border border-transparent rounded-lg text-slate-450 transition-all cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                                      title="Thu hồi"
                                    >
                                      <Undo2 className="h-3 w-3" /> Thu hồi
                                    </button>
                                  )}

                                  {user.role === "admin" && !msg.id.startsWith("gmsg_temp_") && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteGroupMessage(msg.id)}
                                      className="p-1 hover:bg-rose-50 hover:text-rose-600 border border-transparent rounded-lg text-rose-400 transition-all cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                                      title="Xóa tin nhắn (Admin)"
                                    >
                                      <Trash2 className="h-3 w-3" /> Xóa
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input form */}
                <form onSubmit={handleSendGroupMessage} className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col gap-2">
                  {replyToMessage && (
                    <div className="bg-amber-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between text-xs font-semibold shadow-sm mb-1 animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex flex-col min-w-0 pr-4">
                        <span className="text-[9px] text-indigo-600 uppercase font-bold tracking-wider">Đang phản hồi @{replyToMessage.displayName}</span>
                        <p className="text-slate-700 truncate mt-0.5">{replyToMessage.recalled || replyToMessage.deletedByAdmin ? "Tin nhắn đã bị thu hồi" : replyToMessage.text}</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setReplyToMessage(null)}
                        className="p-1 bg-white hover:bg-rose-50 rounded-lg text-slate-950 border border-slate-200 shadow-sm transition-all cursor-pointer shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Nhập tin nhắn..."
                      className="flex-grow bg-white border border-slate-200 text-slate-900 text-xs sm:text-sm font-semibold rounded-xl py-2.5 px-4 focus:outline-none focus:border-indigo-500 placeholder-slate-400 transition-colors shadow-inner"
                      maxLength={200}
                    />
                    <button
                      type="submit"
                      disabled={isSending || !inputText.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:pointer-events-none"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Group Stats Sidebar (Right 1 Col) */}
          <div className="space-y-8">
            {/* Visual Flame Streak Metric */}
            <div className="bg-indigo-900 text-white border border-indigo-800 rounded-3xl p-6 text-center shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.1),transparent)] pointer-events-none" />

              <div className="inline-flex relative mb-4">
                <div className="p-5 bg-indigo-950/40 border border-indigo-800 rounded-full shadow-inner animate-pulse">
                  <Flame className="h-16 w-16 text-amber-400 fill-amber-400 shadow-2xl" />
                </div>
                {group.currentStreak > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-sans font-extrabold text-[10px] py-1 px-2.5 rounded-full border border-indigo-800 animate-bounce uppercase">
                    HOT
                  </span>
                )}
              </div>

              <h3 className="font-sans font-bold text-indigo-200 text-xs tracking-wider uppercase">CHUỖI NHÓM HIỆN TẠI</h3>
              <p className="text-5xl font-sans font-extrabold text-white tracking-tight mt-1 mb-1">
                {group.currentStreak} <span className="text-xl text-amber-400 font-bold font-sans">Ngày</span>
              </p>
              <p className="text-xs text-indigo-200 mb-6 font-medium">
                Giữ vững mục tiêu để nhận kỷ lục ăn mừng!
              </p>

              <div className="grid grid-cols-2 gap-4 bg-indigo-950 border border-indigo-850 p-4 rounded-2xl text-left">
                <div>
                  <span className="block text-[9px] text-indigo-300 font-bold font-sans">KỶ LỤC DÀI NHẤT</span>
                  <span className="font-bold text-base text-white">{group.longestStreak} ngày</span>
                </div>
                <div>
                  <span className="block text-[9px] text-indigo-300 font-bold font-sans">LƯỢT KHÔI PHỤC</span>
                  <span className="font-bold text-base text-amber-400 flex items-center gap-1 font-sans">
                    <LifeBuoy className="h-4 w-4" /> {group.restoreTokensAvailable} lượt
                  </span>
                </div>
              </div>
            </div>

            {/* Streak Milestone Rewards explanation */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5 text-indigo-600" />
                <h3 className="font-sans font-bold text-sm text-slate-900">Cột Mốc & Lượt Khôi Phục</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4 font-medium">
                Nhóm học tập đạt các mốc sau sẽ mở khóa số lượt khôi phục chuỗi tối đa có sẵn tại thời điểm đó:
              </p>

              <div className="space-y-1">
                {[
                  { m: "Mốc 10 ngày đầu tiên", r: "+1 Lượt khôi phục (Tối đa 1)" },
                  { m: "Mốc 30 ngày tiếp theo", r: "+2 Lượt khôi phục (Tối đa 2)" },
                  { m: "Mốc 50 ngày bứt phá", r: "+3 Lượt khôi phục (Tối đa 3)" },
                  { m: "Mốc 100 ngày huyền thoại", r: "+5 Lượt khôi phục (Tối đa 5)" },
                ].map((row, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0 font-sans"
                  >
                    <span className="text-slate-500 font-medium">{row.m}</span>
                    <span className="text-indigo-600 font-bold">{row.r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>

      {/* MILESTONE CELEBRATION OVERLAY & CONFIRM MODAL */}
      <AnimatePresence>
        {showMilestoneOverlay && celebratedMilestone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white border border-indigo-100 p-8 rounded-3xl max-w-md w-full text-center relative overflow-hidden shadow-xl"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-indigo-50 to-transparent pointer-events-none" />

              <div className="inline-flex p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4 animate-bounce border border-indigo-100">
                <Flame className="h-16 w-16 text-amber-500 fill-amber-500" />
              </div>

              <h4 className="text-2xl font-extrabold text-slate-950 mb-2 tracking-tight">Ăn Mừng Cột Mốc: {celebratedMilestone} Ngày! 🌟</h4>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Nhóm học tập của bạn đã đạt mốc **{celebratedMilestone} ngày liên tiếp** học từ vựng không ngắt quãng! Đây là một kỷ lục vô cùng tuyệt vời và đáng khâm phục.
              </p>

              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-6">
                <p className="text-xs text-indigo-600 font-bold font-sans tracking-wider uppercase mb-1">MỞ KHÓA KHÔI PHỤC CHUỒI</p>
                <p className="text-sm text-slate-700 font-bold">
                  Tổng lượt khôi phục khả dụng của nhóm tại thời điểm này đã tăng lên thành: **{getRestoreTokensForStreak(celebratedMilestone)} lượt**.
                </p>
              </div>

              <button
                onClick={() => setShowMilestoneOverlay(false)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3 px-6 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" /> Tiếp tục học bài
              </button>
            </motion.div>
          </motion.div>
        )}

        {confirmModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl max-w-md w-full relative overflow-hidden shadow-xl"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-2xl shrink-0 ${confirmModal.isDanger ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-indigo-50 text-indigo-600 border border-indigo-100"}`}>
                  {confirmModal.isDanger ? <AlertTriangle className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-slate-950 font-sans tracking-tight">
                    {confirmModal.title}
                  </h4>
                  <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all cursor-pointer border border-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={confirmModal.onConfirm}
                  className={`px-5 py-2.5 text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-sm ${
                    confirmModal.isDanger
                      ? "bg-rose-600 hover:bg-rose-700 hover:shadow-rose-600/10"
                      : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-600/10"
                  }`}
                >
                  {confirmModal.confirmText || "Xác nhận"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
