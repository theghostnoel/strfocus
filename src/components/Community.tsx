import React, { useState, useEffect, useRef } from "react";
import { AppUser, Message, CommunitySettings } from "../types";
import { collection, query, orderBy, limit, addDoc, serverTimestamp, onSnapshot, doc, updateDoc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { MessageSquare, Send, Sparkles, ExternalLink, Users, Disc, ShieldAlert, Award, Hash, Zap, X, CornerUpLeft, Undo2, Trash2, Smile } from "lucide-react";
import { motion } from "motion/react";
import { LocalDB } from "../utils/localDb";

interface CommunityProps {
  user: AppUser;
  communitySettings?: CommunitySettings | null;
}

export default function Community({ user, communitySettings }: CommunityProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    messageId: string;
    type: "recall" | "delete";
  } | null>(null);

  const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
  
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const userHasScrolledUp = useRef(false);

  // Subscribe to real-time chat messages
  useEffect(() => {
    setLoadingChat(true);
    
    // Load local messages immediately so chat is never empty or frozen!
    const localMsgs = LocalDB.getMessages();
    setMessages(localMsgs);
    setLoadingChat(false);

    const messagesCol = collection(db, "messages");
    const q = query(messagesCol, orderBy("createdAt", "desc"), limit(40));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data({ serverTimestamps: "estimate" }) } as Message);
      });
      
      const reversed = list.reverse();
      // Save all received messages to LocalDB to keep synchronized
      reversed.forEach(m => LocalDB.addMessage(m));
      
      setMessages(reversed.length > 0 ? reversed : LocalDB.getMessages());
      setLoadingChat(false);
    }, (error) => {
      console.warn("Firestore messages onSnapshot failed, using local database:", error);
      setMessages(LocalDB.getMessages());
      setLoadingChat(false);
    });

    const handleStorage = () => {
      setMessages(LocalDB.getMessages());
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const handleScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;

    // Distance from bottom
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    
    // If the user scrolled up by more than 150px, we set userHasScrolledUp to true
    if (distanceFromBottom > 150) {
      userHasScrolledUp.current = true;
    } else {
      userHasScrolledUp.current = false;
    }
  };

  const forceScrollToBottom = (smooth = true) => {
    setTimeout(() => {
      const container = chatContainerRef.current;
      if (container) {
        if (smooth) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth"
          });
        } else {
          container.scrollTop = container.scrollHeight;
        }
      }
    }, 80);
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    const isMyMessage = latestMessage?.uid === user.uid;

    // Only scroll to bottom if user hasn't scrolled up, OR if it's the user's own message
    if (!userHasScrolledUp.current || isMyMessage) {
      forceScrollToBottom(true);
      userHasScrolledUp.current = false; // Reset status on auto-scroll
    }
  }, [messages, user.uid]);

  // Initial scroll when chat loads
  useEffect(() => {
    if (!loadingChat) {
      forceScrollToBottom(false);
    }
  }, [loadingChat]);

  const handleRecallMessage = (messageId: string) => {
    if (messageId.startsWith("msg_temp_")) return;
    setConfirmAction({ messageId, type: "recall" });
  };

  const handleDeleteMessage = (messageId: string) => {
    if (messageId.startsWith("msg_temp_")) return;
    setConfirmAction({ messageId, type: "delete" });
  };

  const executeConfirmedAction = async () => {
    if (!confirmAction) return;
    const { messageId, type } = confirmAction;
    setConfirmAction(null);

    try {
      const msgRef = doc(db, "messages", messageId);
      if (type === "recall") {
        await updateDoc(msgRef, { recalled: true });
      } else if (type === "delete") {
        await updateDoc(msgRef, { deletedByAdmin: true });
      }
    } catch (err) {
      console.error(`Lỗi khi ${type === "recall" ? "thu hồi" : "xóa"} tin nhắn:`, err);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (messageId.startsWith("msg_temp_")) return;
    
    try {
      const msgRef = doc(db, "messages", messageId);
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
      console.error("Lỗi khi cập nhật cảm xúc:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText) return;

    setInputText("");
    setIsSending(true);

    const replyToData = replyToMessage ? {
      id: replyToMessage.id,
      displayName: replyToMessage.displayName,
      text: replyToMessage.recalled || replyToMessage.deletedByAdmin ? "Tin nhắn đã bị thu hồi" : replyToMessage.text
    } : null;

    const tempMessage: Message = {
      id: `msg_temp_${Date.now()}`,
      uid: user.uid,
      displayName: user.displayName,
      role: user.role,
      text: cleanText,
      avatarUrl: user.avatarUrl || null,
      createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any,
      replyTo: replyToData
    };

    setReplyToMessage(null);

    // Save locally immediately for ultra fast visual response!
    LocalDB.addMessage(tempMessage);
    window.dispatchEvent(new Event("storage"));
    
    // Scroll instantly
    forceScrollToBottom(true);

    try {
      const messagesCol = collection(db, "messages");
      await addDoc(messagesCol, {
        uid: user.uid,
        displayName: user.displayName,
        role: user.role,
        text: cleanText,
        avatarUrl: user.avatarUrl || null,
        createdAt: serverTimestamp(),
        replyTo: replyToData
      });
      // Scroll again after Firestore sync
      forceScrollToBottom(true);
    } catch (error) {
      console.warn("Firestore addDoc message failed, message is preserved locally:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Define potential community channels
  const rawLinks = [
    {
      title: communitySettings?.zaloTitle || "Cộng Đồng Zalo",
      description: communitySettings?.zaloDesc || "Nơi thảo luận, trao đổi các bài học tiếng Anh và tuyển thêm thành viên tham gia nhóm giữ chuỗi hàng ngày.",
      url: communitySettings?.zaloUrl || "https://zalo.me/g/community",
      color: "bg-cyan-200 text-slate-950 border-cyan-400",
      cta: "Tham gia nhóm Zalo",
      icon: Users
    },
    {
      title: communitySettings?.discordTitle || "Server Discord Học Tập",
      description: communitySettings?.discordDesc || "Tham gia phòng voice chat học tiếng Anh giao tiếp 24/7 cùng giáo viên bản xứ và các chiến thần giữ chuỗi.",
      url: communitySettings?.discordUrl || "https://discord.gg/english-streak",
      color: "bg-violet-200 text-slate-950 border-violet-400",
      cta: "Vào Server Discord",
      icon: Disc
    },
    {
      title: communitySettings?.facebookTitle || "Group Facebook Săn Học Bổng",
      description: communitySettings?.facebookDesc || "Chia sẻ tài liệu thi IELTS, TOEIC, bài tập ôn thi THPT Quốc gia cùng hàng chục ngàn học sinh toàn quốc.",
      url: communitySettings?.facebookUrl || "https://facebook.com/groups/english-scholarship",
      color: "bg-pink-200 text-slate-950 border-pink-400",
      cta: "Gia nhập nhóm Facebook",
      icon: Award
    }
  ];

  // Only display links that are NOT empty
  const communityLinks = rawLinks.filter(link => link.url && link.url.trim() !== "");
  const hasSidebarLinks = communityLinks.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header Banner - GenZ Neo Brutalism yellow/amber style */}
      <div className="bg-yellow-300 border-4 border-slate-950 rounded-3xl p-6 sm:p-8 mb-8 shadow-[5px_5px_0px_0px_rgba(2,6,23,1)] relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-400/20 rounded-full filter blur-xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="bg-slate-950 text-yellow-300 text-[10px] px-3 py-1 rounded-xl font-black tracking-widest uppercase border-2 border-slate-950 shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)]">
              CỘNG ĐỒNG LIÊN KẾT 🌟
            </span>
            <span className="bg-white text-slate-950 text-[10px] px-3 py-1 rounded-xl font-black tracking-widest uppercase border-2 border-slate-950 shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)] flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-indigo-600 fill-indigo-600" /> TƯƠNG TÁC THỜI GIAN THỰC
            </span>
          </div>
          <h2 className="text-2xl sm:text-4.5xl font-sans font-black text-slate-950 tracking-tight leading-none uppercase">
            Giao Lưu & Kết Nối Đồng Đội 🤝
          </h2>
          <p className="text-sm sm:text-base text-slate-900 mt-2 max-w-2xl font-bold leading-relaxed">
            Học tập không cô đơn! Hãy tìm kiếm những người bạn có cùng chí hướng để tạo nhóm giữ chuỗi học từ vựng, hoặc cùng nhau giải đáp các thắc mắc về ngữ pháp tiếng Anh.
          </p>
        </div>
      </div>

      {/* On Mobile & Tablet: Render prominent quick links ABOVE the chat box so they are instantly visible and clickable */}
      {hasSidebarLinks && (
        <div className="lg:hidden mb-8">
          <h3 className="font-sans font-black text-xs sm:text-sm text-slate-950 flex items-center gap-2 uppercase tracking-tight mb-3">
            <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" /> NHÓM LIÊN KẾT NHẬN HỖ TRỢ & HỌC TẬP 🚀
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {communityLinks.map((link, idx) => {
              const Icon = link.icon;
              return (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  referrerPolicy="no-referrer"
                  className={`${link.color} border-4 border-slate-950 rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(2,6,23,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-between gap-3 cursor-pointer`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-white border-2 border-slate-950 rounded-xl text-slate-950 shrink-0 shadow-[1px_1px_0px_0px_rgba(2,6,23,1)]">
                      <Icon className="h-4.5 w-4.5 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-950 text-xs sm:text-sm truncate leading-tight uppercase tracking-tight">{link.title}</h4>
                      <p className="text-[10px] text-slate-800 font-bold mt-1 bg-white/60 border border-slate-950/20 px-1.5 py-0.5 rounded inline-block truncate">{link.cta}</p>
                    </div>
                  </div>
                  <div className="p-2 bg-white border-2 border-slate-950 rounded-xl shadow-[1px_1px_0px_0px_rgba(2,6,23,1)] text-slate-950 shrink-0">
                    <ExternalLink className="h-4 w-4 stroke-[2.5]" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Real-time Group Chat Component */}
        <div className={`${hasSidebarLinks ? "lg:col-span-2" : "lg:col-span-3"} bg-white border-4 border-slate-950 rounded-3xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(2,6,23,1)] flex flex-col h-[600px] justify-between`}>
          {/* Chat Header */}
          <div className="bg-indigo-300 border-b-4 border-slate-950 px-6 py-4.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-950 text-yellow-300 border-2 border-slate-950 rounded-2xl shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                <Hash className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-950 tracking-tight leading-none">Phòng Chat Học Tập Toàn Quốc 💬</h3>
                <p className="text-[9px] text-slate-800 font-black tracking-wider uppercase mt-1">Real-time chat enabled via Firestore</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[9px] text-slate-950 font-black tracking-widest bg-emerald-300 border-2 border-slate-950 py-1.5 px-3 rounded-full shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)]">
              <span className="h-2 w-2 bg-slate-950 rounded-full animate-ping" />
              <span>TRỰC TUYẾN</span>
            </div>
          </div>

          {/* Chat Messages Log */}
          <div 
            ref={chatContainerRef}
            onScroll={handleScroll}
            className="p-6 overflow-y-auto flex-grow space-y-4 bg-slate-50/50"
          >
            {loadingChat ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-700 font-black text-xs uppercase">
                <div className="animate-spin rounded-full h-8 w-8 border-b-4 border-indigo-600 mb-3" />
                Đang tải tin nhắn...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center">
                <div className="p-4 bg-slate-100 border-2 border-slate-950 rounded-3xl mb-3 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                  <MessageSquare className="h-8 w-8 text-slate-850" />
                </div>
                <p className="text-sm font-black text-slate-900 uppercase">Chưa có tin nhắn nào</p>
                <p className="text-xs font-bold text-slate-600 mt-1">Hãy là người đầu tiên gửi tin nhắn truyền cảm hứng!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.uid === user.uid;
                const isMsgAdmin = (msg as any).role === "admin";
                const isSystem = msg.uid === "db_user_admin" && msg.displayName === "Hệ thống";
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
                        <span className="truncate bg-slate-200/60 border border-slate-300 px-2 py-0.5 rounded text-slate-700">
                          Trả lời <strong className="text-slate-900">@{msg.replyTo.displayName}</strong>: {msg.replyTo.text}
                        </span>
                      </div>
                    )}

                    <div className={`flex items-start gap-2 w-full ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                      {/* User Avatar */}
                      {msg.avatarUrl ? (
                        <img 
                          src={msg.avatarUrl} 
                          alt="Avatar" 
                          className="w-8 h-8 rounded-full border-2 border-slate-950 object-cover bg-white shrink-0 shadow-[1px_1px_0px_0px_rgba(2,6,23,1)]" 
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-200 border-2 border-slate-950 flex items-center justify-center font-black text-xs text-slate-950 shrink-0 shadow-[1px_1px_0px_0px_rgba(2,6,23,1)]">
                          {msg.displayName ? msg.displayName.charAt(0).toUpperCase() : "?"}
                        </div>
                      )}

                      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        {/* Sender name & role tag */}
                        <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-600 font-bold">
                          <span className="font-black text-slate-900">{msg.displayName}</span>
                          {isMsgAdmin && (
                            <span className="bg-rose-300 text-slate-950 border-2 border-slate-950 text-[8px] py-0.5 px-1.5 rounded-full font-black tracking-widest">
                              ADMIN 👑
                            </span>
                          )}
                        </div>

                        {/* Message Bubble */}
                        {isRecalled ? (
                          <div className="p-3 rounded-2xl text-xs leading-relaxed border-2 border-dashed border-slate-300 bg-slate-100 text-slate-400 font-bold italic shadow-inner rounded-tr-none">
                            Tin nhắn đã bị thu hồi ↩️
                          </div>
                        ) : isDeleted ? (
                          <div className="p-3 rounded-2xl text-xs leading-relaxed border-2 border-dashed border-red-300 bg-red-50 text-red-400 font-bold flex items-center gap-1.5 shadow-inner rounded-tl-none">
                            <ShieldAlert className="h-3.5 w-3.5 stroke-[2.5]" /> Tin nhắn đã bị quản trị viên xóa 🛡️
                          </div>
                        ) : (
                          <div
                            className={`p-3 rounded-2xl text-sm leading-relaxed border-2 border-slate-950 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)] break-words font-medium ${
                              isMe
                                ? "bg-yellow-200 text-slate-950 rounded-tr-none"
                                : isMsgAdmin
                                ? "bg-rose-100 text-slate-950 rounded-tl-none"
                                : "bg-white text-slate-950 rounded-tl-none"
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
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
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

                        {/* Interactive Actions (Reply, Recall, Delete) */}
                        {!isRecalled && !isDeleted && !isSystem && (
                          <div className="flex items-center gap-1.5 mt-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-150">
                            <button
                              type="button"
                              onClick={() => setReplyToMessage(msg)}
                              className="p-1 hover:bg-slate-200 border border-transparent hover:border-slate-950 rounded-lg text-slate-600 transition-all cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                              title="Phản hồi"
                            >
                              <CornerUpLeft className="h-3 w-3 stroke-[2.5]" /> Phản hồi
                            </button>

                            {/* Emoji reaction picker button */}
                            {!msg.id.startsWith("msg_temp_") && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setActiveEmojiPicker(activeEmojiPicker === msg.id ? null : msg.id)}
                                  className={`p-1 border border-transparent rounded-lg text-slate-600 transition-all cursor-pointer flex items-center gap-0.5 text-[10px] font-bold ${
                                    activeEmojiPicker === msg.id 
                                      ? "bg-indigo-50 border-slate-950 text-indigo-700" 
                                      : "hover:bg-slate-200 hover:border-slate-950"
                                  }`}
                                  title="Thả cảm xúc"
                                >
                                  <Smile className="h-3.5 w-3.5 stroke-[2.5]" /> Cảm xúc
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
                                            handleToggleReaction(msg.id, emoji);
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
                            
                            {isMe && !msg.id.startsWith("msg_temp_") && (
                              <button
                                type="button"
                                onClick={() => handleRecallMessage(msg.id)}
                                className="p-1 hover:bg-amber-100 hover:text-amber-700 border border-transparent hover:border-amber-300 rounded-lg text-slate-400 transition-all cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                                        title="Thu hồi"
                              >
                                <Undo2 className="h-3 w-3 stroke-[2.5]" /> Thu hồi
                              </button>
                            )}

                            {user.role === "admin" && !msg.id.startsWith("msg_temp_") && (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="p-1 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-300 rounded-lg text-rose-400 transition-all cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                                title="Xóa tin nhắn (Admin)"
                              >
                                <Trash2 className="h-3 w-3 stroke-[2.5]" /> Xóa
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

          {/* Chat Input Field */}
          <form onSubmit={handleSendMessage} className="bg-slate-100 border-t-4 border-slate-950 p-4.5 flex flex-col gap-3">
            {replyToMessage && (
              <div className="bg-amber-50 border-2 border-slate-950 p-3 rounded-2xl flex items-center justify-between text-xs font-bold shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="text-[9px] text-indigo-600 uppercase font-black tracking-wider">Đang phản hồi @{replyToMessage.displayName}</span>
                  <p className="text-slate-800 truncate mt-0.5">{replyToMessage.text}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setReplyToMessage(null)}
                  className="p-1 bg-white hover:bg-rose-50 rounded-xl text-slate-950 border-2 border-slate-950 shadow-[1px_1px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer shrink-0"
                >
                  <X className="h-4 w-4 stroke-[2.5]" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Nhập tin nhắn của bạn để gửi cho đồng đội..."
                className="flex-grow bg-white border-2 border-slate-950 text-slate-900 text-sm font-bold rounded-2xl py-3 px-4.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400 transition-colors shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]"
                maxLength={250}
              />
              <button
                type="submit"
                disabled={isSending || !inputText.trim()}
                className="bg-indigo-400 hover:bg-indigo-500 disabled:bg-slate-300 disabled:text-slate-500 border-2 border-slate-950 text-slate-950 p-3.5 rounded-2xl shadow-[2px_2px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center shrink-0 cursor-pointer disabled:pointer-events-none disabled:transform-none"
                id="btn-send-chat"
              >
                <Send className="h-4.5 w-4.5 stroke-[2.5]" />
              </button>
            </div>
          </form>
        </div>

        {/* Quick Links Sidebar */}
        {hasSidebarLinks && (
          <div className="hidden lg:block space-y-6">
            <h3 className="font-sans font-black text-lg text-slate-950 flex items-center gap-2 uppercase tracking-tight">
              <Sparkles className="h-5.5 w-5.5 text-indigo-600 animate-pulse" /> Nhóm Nhận Hỗ Trợ 🚀
            </h3>

            <div className="space-y-5">
              {communityLinks.map((link, idx) => {
                const Icon = link.icon;
                return (
                  <div
                    key={idx}
                    className={`${link.color} border-4 border-slate-950 rounded-2xl p-5 shadow-[3px_3px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex flex-col justify-between`}
                  >
                    <div>
                      <div className="p-3 bg-white border-2 border-slate-950 rounded-2xl inline-block mb-3 shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)] text-slate-900">
                        <Icon className="h-5 w-5 stroke-[2.5]" />
                      </div>
                      <h4 className="font-black text-slate-950 text-base mb-1.5 leading-tight">{link.title}</h4>
                      <p className="text-xs text-slate-800 leading-relaxed font-bold mb-4">{link.description}</p>
                    </div>

                    <a
                      href={link.url}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="w-full bg-white hover:bg-slate-50 border-2 border-slate-950 text-slate-950 text-xs font-black py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-[1.5px_1.5px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-center cursor-pointer"
                    >
                      {link.cta}
                      <ExternalLink className="h-3.5 w-3.5 stroke-[2.5]" />
                    </a>
                  </div>
                );
              })}
            </div>

            {/* Quick Notice Card */}
            <div className="bg-amber-100 border-4 border-slate-950 rounded-2xl p-4.5 flex items-start gap-3 shadow-[3px_3px_0px_0px_rgba(2,6,23,1)]">
              <ShieldAlert className="h-5.5 w-5.5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-850 leading-relaxed font-bold">
                <h5 className="font-black text-slate-950 mb-0.5 uppercase tracking-wide">Nội quy cộng đồng ⚖️</h5>
                <p>Mọi tin nhắn thảo luận không văn minh hoặc lừa đảo sẽ bị quản trị viên gỡ bỏ tài khoản vĩnh viễn khỏi hệ thống.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-4 border-slate-950 p-6 rounded-2xl max-w-sm w-full shadow-[6px_6px_0px_0px_rgba(2,6,23,1)]">
            <h3 className="font-sans font-black text-lg text-slate-950 mb-3 uppercase tracking-tight flex items-center gap-2">
              <ShieldAlert className="h-5.5 w-5.5 text-rose-500 animate-bounce" />
              Xác nhận thao tác
            </h3>
            <p className="text-sm font-bold text-slate-700 leading-relaxed mb-6">
              {confirmAction.type === "recall" 
                ? "Bạn có chắc chắn muốn thu hồi tin nhắn này? Hành động này sẽ được đồng bộ ngay lập tức với các học viên khác."
                : "Bạn có chắc chắn muốn xóa tin nhắn này với tư cách Quản trị viên? Tin nhắn sẽ bị ẩn vĩnh viễn trên mọi thiết bị."
              }
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="bg-slate-100 hover:bg-slate-200 border-2 border-slate-950 text-slate-950 text-xs font-black py-2.5 px-4 rounded-xl shadow-[2px_2px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeConfirmedAction}
                className="bg-rose-400 hover:bg-rose-500 border-2 border-slate-950 text-slate-950 text-xs font-black py-2.5 px-4 rounded-xl shadow-[2px_2px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all cursor-pointer"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
