export type UserRole = "student" | "admin";

export interface Subject {
  id: string;
  name: string;
  isActive: boolean;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  groupId: string | null; // backward compatibility
  groupIds?: string[]; // user can participate in multiple groups
  avatarUrl?: string; // base64 or photo URL
  password?: string; // for fallback database password update
  username?: string; // unique lowercase username handle
  friends?: string[]; // array of friend UIDs
}

export interface Word {
  id: string;
  english: string;
  vietnamese: string;
  example?: string;
  phonetic?: string;
  exampleTranslate?: string;
}

export interface VocabularySet {
  id: string;
  title: string;
  description: string;
  words: Word[];
  wordsCount: number;
  subjectId: string; // associated subject
  createdAt?: any; // Firestore Timestamp
}

export interface Progress {
  id: string; // uid_subjectId_setId_date
  uid: string;
  subjectId: string; // associated subject
  setId: string;
  date: string; // YYYY-MM-DD
  completedWords: string[]; // List of word IDs marked as "Đã nhớ"
  incorrectWords: string[]; // List of word IDs marked as "Chưa nhớ"
  completedPercent: number;
  isCompleted: boolean;
  updatedAt: any; // Firestore Timestamp
}

export interface Group {
  id: string;
  name: string;
  subjectId: string; // fixed subject for the group
  memberIds: string[];
  ownerId: string;
  currentStreak: number;
  longestStreak: number;
  restoreTokensAvailable: number;
  lastStreakDate: string | null; // YYYY-MM-DD
  createdAt?: any; // Firestore Timestamp
}

export interface GroupMemberStatus {
  uid: string;
  displayName: string;
  email: string;
  isCompleted: boolean;
  completedPercent: number;
  joinedDate?: string; // YYYY-MM-DD when member joined the group
}

export interface GroupDailyStatus {
  id: string; // date
  date: string; // YYYY-MM-DD
  memberProgress: { [uid: string]: GroupMemberStatus };
  isGroupCompleted: boolean;
  isStreakUpdated: boolean;
}

export interface Message {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  createdAt: any;
  role?: string;
  avatarUrl?: string | null;
  recalled?: boolean;
  deletedByAdmin?: boolean;
  replyTo?: {
    id: string;
    displayName: string;
    text: string;
  } | null;
  reactions?: {
    [emoji: string]: string[]; // maps emoji to array of uids who reacted
  };
}

export interface CommunitySettings {
  zaloUrl: string;
  zaloTitle: string;
  zaloDesc: string;
  zaloActive?: boolean;
  discordUrl: string;
  discordTitle: string;
  discordDesc: string;
  discordActive?: boolean;
  facebookUrl: string;
  facebookTitle: string;
  facebookDesc: string;
  facebookActive?: boolean;
}
