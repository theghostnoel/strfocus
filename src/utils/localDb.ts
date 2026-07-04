import { Subject, VocabularySet, AppUser, Progress, Group, Message, Word, CommunitySettings } from "../types";

const INITIAL_SUBJECTS: Subject[] = [
  { id: "subj_eng", name: "Tiếng Anh", isActive: true },
  { id: "subj_math", name: "Toán học", isActive: true },
  { id: "subj_geo", name: "Địa lý", isActive: true }
];

const INITIAL_SETS: VocabularySet[] = [
  {
    id: "set_travel_01",
    title: "Chủ đề 1: Du lịch & Khám phá (Travel & Adventure)",
    description: "Những từ vựng thông dụng và đắt giá nhất để miêu tả về những chuyến đi, phong cảnh và trải nghiệm du lịch.",
    wordsCount: 5,
    subjectId: "subj_eng",
    words: [
      {
        id: "w_tr_1",
        english: "Adventure",
        vietnamese: "Cuộc phiêu lưu, trải nghiệm mạo hiểm",
        phonetic: "/ədˈventʃər/",
        example: "The trip to the Amazon was a great adventure."
      },
      {
        id: "w_tr_2",
        english: "Destination",
        vietnamese: "Điểm đến, đích đến",
        phonetic: "/ˌdestɪˈneɪʃn/",
        example: "Paris is a very popular tourist destination."
      },
      {
        id: "w_tr_3",
        english: "Itinerary",
        vietnamese: "Lịch trình chuyến đi, lộ trình",
        phonetic: "/aɪˈtɪnəreri/",
        example: "We planned our itinerary carefully before leaving."
      },
      {
        id: "w_tr_4",
        english: "Landscape",
        vietnamese: "Phong cảnh thiên nhiên",
        phonetic: "/ˈlændskeɪp/",
        example: "The mountainous landscape was breathtaking."
      },
      {
        id: "w_tr_5",
        english: "Breathtaking",
        vietnamese: "Đẹp đến ngỡ ngàng, ngoạn mục",
        phonetic: "/ˈbreθteɪkɪŋ/",
        example: "The view from the top of the mountain is breathtaking."
      }
    ]
  },
  {
    id: "set_tech_02",
    title: "Chủ đề 2: Công nghệ & Tương lai (Technology & Future)",
    description: "Từ vựng về trí tuệ nhân tạo, thiết bị số và các công nghệ đột phá định hình tương lai loài người.",
    wordsCount: 5,
    subjectId: "subj_eng",
    words: [
      {
        id: "w_te_1",
        english: "Artificial",
        vietnamese: "Nhân tạo (không phải tự nhiên)",
        phonetic: "/ˌɑːrtɪˈfɪʃl/",
        example: "Artificial Intelligence is transforming industries."
      },
      {
        id: "w_te_2",
        english: "Breakthrough",
        vietnamese: "Sự đột phá, bước tiến lớn",
        phonetic: "/ˈbreɪkθruː/",
        example: "Scientists made a major breakthrough in cancer research."
      },
      {
        id: "w_te_3",
        english: "Cybersecurity",
        vietnamese: "An ninh mạng",
        phonetic: "/ˌsaɪbər sɪˈkjʊrəti/",
        example: "Companies are investing heavily in cybersecurity."
      },
      {
        id: "w_te_4",
        english: "Innovation",
        vietnamese: "Sự đổi mới, sáng kiến cải tiến",
        phonetic: "/ˌɪnəˈveɪʃn/",
        example: "Innovation is key to a company's survival."
      },
      {
        id: "w_te_5",
        english: "Virtual",
        vietnamese: "Ảo (mô phỏng bằng máy tính)",
        phonetic: "/ˈvɜːrtʃuəl/",
        example: "Virtual reality games are becoming very realistic."
      }
    ]
  },
  {
    id: "set_edu_03",
    title: "Chủ đề 3: Học tập & Sự nghiệp (Education & Career)",
    description: "Bộ từ vựng cần thiết để giao tiếp và viết luận về trường học, học bổng, rèn luyện kỹ năng và công việc.",
    wordsCount: 5,
    subjectId: "subj_eng",
    words: [
      {
        id: "w_ed_1",
        english: "Academic",
        vietnamese: "Thuộc về học thuật, viện hàn lâm",
        phonetic: "/ˌækəˈdemɪk/",
        example: "She has achieved outstanding academic success."
      },
      {
        id: "w_ed_2",
        english: "Curriculum",
        vietnamese: "Chương trình học, khung giáo trình",
        phonetic: "/kəˈrɪkjələm/",
        example: "The school curriculum includes computer science."
      },
      {
        id: "w_ed_3",
        english: "Internship",
        vietnamese: "Kỳ thực tập, công việc thực tập",
        phonetic: "/ˈɪntɜːrnʃɪp/",
        example: "He got a paid internship at a technology startup."
      },
      {
        id: "w_ed_4",
        english: "Profession",
        vietnamese: "Nghề nghiệp đòi hỏi chuyên môn cao",
        phonetic: "/prəˈfeʃn/",
        example: "Teaching is a highly respected profession."
      },
      {
        id: "w_ed_5",
        english: "Scholarship",
        vietnamese: "Học bổng học tập",
        phonetic: "/ˈskɑːlərʃɪp/",
        example: "She won a full scholarship to study abroad."
      }
    ]
  }
];

export class LocalDB {
  private static get<T>(key: string, defaultValue: T): T {
    const val = localStorage.getItem(key);
    if (!val) {
      this.set(key, defaultValue);
      return defaultValue;
    }
    try {
      return JSON.parse(val) as T;
    } catch {
      return defaultValue;
    }
  }

  private static set(key: string, val: any): void {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // --- fallback indicator ---
  public static isFallbackEnabled(): boolean {
    return localStorage.getItem("use_db_auth_fallback") === "true";
  }

  public static setFallbackEnabled(enabled: boolean): void {
    localStorage.setItem("use_db_auth_fallback", enabled ? "true" : "false");
  }

  // --- subjects ---
  public static getSubjects(): Subject[] {
    return this.get<Subject[]>("local_subjects", INITIAL_SUBJECTS);
  }

  public static saveSubject(subject: Subject): void {
    const subjects = this.getSubjects();
    const idx = subjects.findIndex(s => s.id === subject.id);
    if (idx !== -1) {
      subjects[idx] = subject;
    } else {
      subjects.push(subject);
    }
    this.set("local_subjects", subjects);
  }

  public static deleteSubject(subjectId: string): void {
    const subjects = this.getSubjects();
    const filtered = subjects.filter(s => s.id !== subjectId);
    this.set("local_subjects", filtered);
  }

  // --- users ---
  public static getUsers(): Record<string, AppUser> {
    const adminEmail = "clone1phobo@gmail.com";
    const defaultUsers: Record<string, AppUser> = {
      "db_user_admin": {
        uid: "db_user_admin",
        email: adminEmail,
        displayName: "Quản trị viên",
        role: "admin",
        groupId: null
      } as any
    };
    return this.get<Record<string, AppUser>>("local_users", defaultUsers);
  }

  public static saveUser(user: AppUser): void {
    const users = this.getUsers();
    users[user.uid] = user;
    this.set("local_users", users);
  }

  public static getUser(uid: string): AppUser | null {
    return this.getUsers()[uid] || null;
  }

  // --- vocabularySets ---
  public static getVocabularySets(): VocabularySet[] {
    return this.get<VocabularySet[]>("local_vocab_sets", INITIAL_SETS);
  }

  public static saveVocabularySet(set: VocabularySet): void {
    const sets = this.getVocabularySets();
    const idx = sets.findIndex(s => s.id === set.id);
    if (idx !== -1) {
      sets[idx] = set;
    } else {
      sets.push(set);
    }
    this.set("local_vocab_sets", sets);
  }

  public static deleteVocabularySet(setId: string): void {
    const sets = this.getVocabularySets();
    const filtered = sets.filter(s => s.id !== setId);
    this.set("local_vocab_sets", filtered);
  }

  // --- progress ---
  public static getProgressMap(): Record<string, Progress> {
    return this.get<Record<string, Progress>>("local_progress", {});
  }

  public static saveProgress(progress: Progress): void {
    const map = this.getProgressMap();
    map[progress.id] = progress;
    this.set("local_progress", map);
  }

  public static getProgress(progressId: string): Progress | null {
    return this.getProgressMap()[progressId] || null;
  }

  // --- groups ---
  public static getGroupsMap(): Record<string, Group> {
    return this.get<Record<string, Group>>("local_groups", {});
  }

  public static saveGroup(group: Group): void {
    const map = this.getGroupsMap();
    map[group.id] = group;
    this.set("local_groups", map);
  }

  public static getGroup(groupId: string): Group | null {
    return this.getGroupsMap()[groupId] || null;
  }

  // --- messages ---
  public static getMessages(): Message[] {
    const rawMsgs = this.get<Message[]>("local_messages", [
      {
        id: "msg_default_1",
        uid: "db_user_admin",
        displayName: "Hệ thống",
        role: "admin",
        text: "Chào mừng các bạn đến với phòng chat giữ chuỗi học từ vựng tiếng Anh! Hãy cố gắng học tập cùng đồng đội nhé!",
        createdAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
      }
    ]);

    const seen = new Set<string>();
    const cleaned: Message[] = [];
    let hasDuplicates = false;

    for (const m of rawMsgs) {
      if (!m || !m.id) continue;
      if (!seen.has(m.id)) {
        seen.add(m.id);
        cleaned.push(m);
      } else {
        hasDuplicates = true;
      }
    }

    if (hasDuplicates) {
      this.set("local_messages", cleaned);
    }

    return cleaned;
  }

  public static addMessage(msg: Message): void {
    if (!msg || !msg.id) return;
    const msgs = this.getMessages();
    const idx = msgs.findIndex(m => m.id === msg.id);
    if (idx !== -1) {
      msgs[idx] = msg;
    } else {
      // Check if this is a synced message matching a local temp message from the same user with identical text
      const tempIdx = msgs.findIndex(
        m => m.id.startsWith("msg_temp_") && m.uid === msg.uid && m.text === msg.text
      );
      if (tempIdx !== -1) {
        msgs[tempIdx] = msg;
      } else {
        msgs.push(msg);
      }
    }

    while (msgs.length > 100) {
      msgs.shift();
    }
    this.set("local_messages", msgs);
  }

  // --- community settings ---
  public static getCommunitySettings(): CommunitySettings {
    const DEFAULT_COMMUNITY_SETTINGS: CommunitySettings = {
      zaloUrl: "https://zalo.me/g/community",
      zaloTitle: "Cộng Đồng Zalo",
      zaloDesc: "Nơi thảo luận, trao đổi các bài học tiếng Anh và tuyển thêm thành viên tham gia nhóm giữ chuỗi hàng ngày.",
      zaloActive: true,
      discordUrl: "https://discord.gg/english-streak",
      discordTitle: "Server Discord Học Tập",
      discordDesc: "Tham gia phòng voice chat học tiếng Anh giao tiếp 24/7 cùng giáo viên bản xứ và các chiến thần giữ chuỗi.",
      discordActive: true,
      facebookUrl: "https://facebook.com/groups/english-scholarship",
      facebookTitle: "Group Facebook Săn Học Bổng",
      facebookDesc: "Chia sẻ tài liệu thi IELTS, TOEIC, bài tập ôn thi THPT Quốc gia cùng hàng chục ngàn học sinh toàn quốc.",
      facebookActive: true
    };
    return this.get<CommunitySettings>("local_community_settings", DEFAULT_COMMUNITY_SETTINGS);
  }

  public static saveCommunitySettings(settings: CommunitySettings): void {
    this.set("local_community_settings", settings);
  }
}
