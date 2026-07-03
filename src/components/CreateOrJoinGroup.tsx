import React from "react";
import { Users, Plus, Share2, RefreshCw, ChevronRight, ArrowRight } from "lucide-react";
import { Subject } from "../types";

interface CreateOrJoinGroupProps {
  subjects: Subject[];
  selectedSubjectId: string;
  setSelectedSubjectId: (id: string) => void;
  newGroupName: string;
  setNewGroupName: (name: string) => void;
  groupIdInput: string;
  setGroupIdInput: (id: string) => void;
  handleCreateGroup: (e: React.FormEvent) => void;
  handleJoinGroup: (e: React.FormEvent) => void;
  loadingAction: boolean;
}

export const CreateOrJoinGroup: React.FC<CreateOrJoinGroupProps> = ({
  subjects,
  selectedSubjectId,
  setSelectedSubjectId,
  newGroupName,
  setNewGroupName,
  groupIdInput,
  setGroupIdInput,
  handleCreateGroup,
  handleJoinGroup,
  loadingAction,
}) => {
  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* Welcome Intro */}
      <div className="text-center mb-10">
        <div className="inline-flex p-3 bg-indigo-50 border-2 border-slate-950 text-indigo-600 rounded-2xl mb-4 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]">
          <Users className="h-8 w-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-sans font-black text-slate-950 tracking-tight">
          Giữ Chuỗi Thần Tốc Theo Nhóm (Group Streak)
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-2xl mx-auto leading-relaxed font-sans">
          Học nhóm giúp tăng hiệu quả gấp 3 lần! Hãy lập nhóm từ <strong>2 đến 10 người</strong>.
          Hàng ngày, chỉ cần 1 người quên học, chuỗi ngày của <strong>cả nhóm</strong> sẽ bị đứt.
          Đồng lòng ôn luyện để mở khóa các mốc kỉ lục và tích lũy lượt khôi phục chuỗi nhé!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Create Group Card */}
        <div className="bg-white border-4 border-slate-950 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-[6px_6px_0px_0px_rgba(2,6,23,1)]">
          <div>
            <div className="p-3 bg-indigo-50 text-indigo-600 border-2 border-slate-950 rounded-xl inline-block mb-4 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
              <Plus className="h-5 w-5" />
            </div>
            <h3 className="font-sans font-black text-lg text-slate-950 mb-2">Tạo nhóm giữ chuỗi mới</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Bạn sẽ trở thành trưởng nhóm và có quyền chia sẻ mã ID nhóm cho bạn bè khác tham gia để cùng nhau học tập, cạnh tranh và tích lũy ngày streak.
            </p>
          </div>

          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-black tracking-wider text-slate-500 uppercase mb-1.5">
                Môn học cho nhóm:
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-950 focus:border-indigo-600 text-slate-950 rounded-xl py-3 px-4 text-sm focus:outline-none transition-all focus:bg-white font-bold"
                required
              >
                <option value="">-- Chọn môn học --</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-sans font-black tracking-wider text-slate-500 uppercase mb-1.5">
                Tên nhóm học tập:
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ví dụ: Hội Chiến Thần Từ Vựng, English 9A..."
                className="w-full bg-slate-50 border-2 border-slate-950 focus:border-indigo-600 text-slate-900 rounded-xl py-3 px-4 text-sm focus:outline-none transition-all focus:bg-white font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={loadingAction}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white text-sm font-black py-3 px-4 rounded-xl border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {loadingAction ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Tạo Nhóm Mới"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Join Group Card */}
        <div className="bg-white border-4 border-slate-950 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-[6px_6px_0px_0px_rgba(2,6,23,1)]">
          <div>
            <div className="p-3 bg-indigo-50 text-indigo-600 border-2 border-slate-950 rounded-xl inline-block mb-4 shadow-[2px_2px_0px_0px_rgba(2,6,23,1)]">
              <Share2 className="h-5 w-5" />
            </div>
            <h3 className="font-sans font-black text-lg text-slate-950 mb-2">Tham gia nhóm bằng mã</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Nếu bạn bè của bạn đã tạo nhóm học tập, hãy yêu cầu họ gửi cho bạn mã ID của nhóm và nhập mã đó vào khung bên dưới để đồng hành giữ chuỗi học bài!
            </p>
          </div>

          <form onSubmit={handleJoinGroup} className="space-y-4">
            <div>
              <label className="block text-xs font-sans font-black tracking-wider text-slate-500 uppercase mb-1.5">
                Nhập mã ID nhóm của bạn bè:
              </label>
              <input
                type="text"
                value={groupIdInput}
                onChange={(e) => setGroupIdInput(e.target.value)}
                placeholder="Mã ID nhóm gồm các ký tự ngẫu nhiên..."
                className="w-full bg-slate-50 border-2 border-slate-950 focus:border-indigo-600 text-slate-900 rounded-xl py-3 px-4 text-sm focus:outline-none transition-all font-mono focus:bg-white font-bold"
              />
            </div>
            <button
              type="submit"
              disabled={loadingAction}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-black py-3 px-4 rounded-xl border-2 border-slate-950 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              {loadingAction ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Tham Gia Nhóm Ngay"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
