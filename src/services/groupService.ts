import {
  doc,
  collection,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { Group, AppUser, Progress, GroupDailyStatus, GroupMemberStatus } from "../types";
import { getVNDateString, getVNYesterdayDateString } from "../utils/timezone";
import { LocalDB } from "../utils/localDb";

/**
 * Creates a new streak group
 */
export async function createGroup(name: string, subjectId: string, ownerId: string, ownerName: string, ownerEmail: string): Promise<string> {
  const groupId = Math.floor(10000000 + Math.random() * 90000000).toString();
  
  const localGroup: Group = {
    id: groupId,
    name,
    subjectId,
    memberIds: [ownerId],
    ownerId,
    currentStreak: 0,
    longestStreak: 0,
    restoreTokensAvailable: 2, // start with some friendly tokens
    lastStreakDate: null
  };

  LocalDB.saveGroup(localGroup);
  
  // Update local owner user
  const localUser = LocalDB.getUser(ownerId);
  if (localUser) {
    localUser.groupIds = localUser.groupIds ? [...localUser.groupIds, groupId] : [groupId];
    localUser.groupId = groupId; // backward compatibility
    LocalDB.saveUser(localUser);
  }
  window.dispatchEvent(new Event("storage"));

  try {
    const groupRef = doc(db, "groups", groupId);
    const newGroupData = {
      name,
      subjectId,
      memberIds: [ownerId],
      ownerId,
      currentStreak: 0,
      longestStreak: 0,
      restoreTokensAvailable: 2,
      lastStreakDate: null,
      createdAt: serverTimestamp()
    };

    await setDoc(groupRef, newGroupData);

    // Save to users/{uid} collection in Firestore
    const userRef = doc(db, "users", ownerId);
    await updateDoc(userRef, { 
      groupIds: arrayUnion(groupId),
      groupId: groupId
    });

    // Initialize today's status document for this group
    const todayStr = getVNDateString();
    const dailyStatusRef = doc(db, `groups/${groupId}/dailyStatus`, todayStr);
    await setDoc(dailyStatusRef, {
      id: todayStr,
      date: todayStr,
      memberProgress: {
        [ownerId]: {
          uid: ownerId,
          displayName: ownerName,
          email: ownerEmail,
          isCompleted: false,
          completedPercent: 0
        }
      },
      isGroupCompleted: false,
      isStreakUpdated: false
    });

    return groupId;
  } catch (error) {
    console.warn("Firestore createGroup failed, running locally:", error);
  }

  return groupId;
}

/**
 * Joins an existing group by ID
 */
export async function joinGroup(groupId: string, userId: string, userName: string, userEmail: string): Promise<void> {
  // Try local first
  const localGroup = LocalDB.getGroup(groupId);
  if (localGroup) {
    if (localGroup.memberIds.length >= 10) {
      throw new Error("Nhóm đã đạt số lượng thành viên tối đa (10 người)!");
    }
    if (localGroup.memberIds.includes(userId)) {
      throw new Error("Bạn đã là thành viên của nhóm này rồi!");
    }
    localGroup.memberIds.push(userId);
    LocalDB.saveGroup(localGroup);

    const localUser = LocalDB.getUser(userId);
    if (localUser) {
      localUser.groupIds = localUser.groupIds ? [...localUser.groupIds, groupId] : [groupId];
      localUser.groupId = groupId; // backward compatibility
      LocalDB.saveUser(localUser);
    }
    window.dispatchEvent(new Event("storage"));
  }

  try {
    const groupRef = doc(db, "groups", groupId);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      if (localGroup) return; // handled locally
      throw new Error("Nhóm không tồn tại trên hệ thống!");
    }

    const groupData = groupSnap.data() as Group;

    if (groupData.memberIds.length >= 10) {
      throw new Error("Nhóm đã đạt số lượng thành viên tối đa (10 người)!");
    }

    if (groupData.memberIds.includes(userId)) {
      throw new Error("Bạn đã là thành viên của nhóm này rồi!");
    }

    // Add member to group
    await updateDoc(groupRef, {
      memberIds: arrayUnion(userId)
    });

    // Update user profile
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { 
      groupIds: arrayUnion(groupId),
      groupId 
    });

    // Update today's daily status to include this member
    const todayStr = getVNDateString();
    const dailyStatusRef = doc(db, `groups/${groupId}/dailyStatus`, todayStr);
    const dailyStatusSnap = await getDoc(dailyStatusRef);

    const memberStatus: GroupMemberStatus = {
      uid: userId,
      displayName: userName,
      email: userEmail,
      isCompleted: false,
      completedPercent: 0
    };

    if (dailyStatusSnap.exists()) {
      await updateDoc(dailyStatusRef, {
        [`memberProgress.${userId}`]: memberStatus
      });
    } else {
      await setDoc(dailyStatusRef, {
        id: todayStr,
        date: todayStr,
        memberProgress: {
          [userId]: memberStatus
        },
        isGroupCompleted: false,
        isStreakUpdated: false
      });
    }
  } catch (error: any) {
    console.warn("Firestore joinGroup failed, proceeding with local configuration:", error);
    if (!localGroup) {
      throw error;
    }
  }
}

/**
 * Subscribes to real-time updates for a single group
 */
export function subscribeToGroup(groupId: string, callback: (group: Group | null) => void) {
  // Call immediately with local group info
  const localG = LocalDB.getGroup(groupId);
  callback(localG);

  const groupRef = doc(db, "groups", groupId);
  const unsubscribe = onSnapshot(groupRef, (docSnap) => {
    if (docSnap.exists()) {
      const g = { id: docSnap.id, ...docSnap.data() } as Group;
      LocalDB.saveGroup(g);
      callback(g);
    } else {
      callback(LocalDB.getGroup(groupId));
    }
  }, (error) => {
    console.warn("Firestore subscribeToGroup failed, using LocalDB:", error);
    callback(LocalDB.getGroup(groupId));
  });

  const handleStorage = () => {
    callback(LocalDB.getGroup(groupId));
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    unsubscribe();
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Subscribes to the real-time daily status of a group for a specific date
 */
export function subscribeToDailyStatus(groupId: string, dateStr: string, callback: (status: GroupDailyStatus | null) => void) {
  // Setup a default status object locally
  const localStatus: GroupDailyStatus = {
    id: dateStr,
    date: dateStr,
    memberProgress: {},
    isGroupCompleted: false,
    isStreakUpdated: false
  };

  const localGroup = LocalDB.getGroup(groupId);
  if (localGroup) {
    const isEnglishGroup = localGroup.subjectId === "subj_eng" || localGroup.subjectId === "daily_random";
    const setsForSubject = LocalDB.getVocabularySets().filter(s => s.subjectId === localGroup.subjectId);
    localGroup.memberIds.forEach(mId => {
      const member = LocalDB.getUser(mId);
      if (member) {
        let isMemberCompleted = false;
        let memberCompletedPercent = 0;

        if (isEnglishGroup) {
          const dailyProgId = `${mId}_daily_random_daily_random_set_${dateStr}`;
          const dailyProg = LocalDB.getProgress(dailyProgId);
          
          const progressMap = LocalDB.getProgressMap();
          const completedWordsSet = new Set<string>();
          Object.values(progressMap).forEach((p) => {
            if (p.uid === mId && p.date === dateStr && (p.subjectId === "subj_eng" || p.subjectId === "daily_random")) {
              if (Array.isArray(p.completedWords)) {
                p.completedWords.forEach(wId => completedWordsSet.add(wId));
              }
            }
          });
          
          const totalWordsCompletedToday = completedWordsSet.size;
          isMemberCompleted = !!(dailyProg && dailyProg.isCompleted) || totalWordsCompletedToday >= 20;
          memberCompletedPercent = isMemberCompleted ? 100 : Math.round((totalWordsCompletedToday / 20) * 100);
        } else if (setsForSubject.length > 0) {
          const progressList = setsForSubject.map(set => {
            const progId = `${mId}_${localGroup.subjectId}_${set.id}_${dateStr}`;
            return LocalDB.getProgress(progId);
          });
          isMemberCompleted = progressList.every(p => p && p.isCompleted);
          const totalPercent = progressList.reduce((sum, p) => sum + (p ? p.completedPercent : 0), 0);
          memberCompletedPercent = Math.round(totalPercent / setsForSubject.length);
        }
        
        localStatus.memberProgress[mId] = {
          uid: mId,
          displayName: member.displayName,
          email: member.email,
          isCompleted: isMemberCompleted,
          completedPercent: memberCompletedPercent
        };
      }
    });
    localStatus.isGroupCompleted = Object.values(localStatus.memberProgress).length > 0 && 
      Object.values(localStatus.memberProgress).every(p => p.isCompleted);
  }
  callback(localStatus);

  const statusRef = doc(db, `groups/${groupId}/dailyStatus`, dateStr);
  const unsubscribe = onSnapshot(statusRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as GroupDailyStatus);
    } else {
      callback(localStatus);
    }
  }, (error) => {
    console.warn("Firestore subscribeToDailyStatus failed, using LocalDB:", error);
    callback(localStatus);
  });

  const handleStorage = () => {
    callback(localStatus);
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    unsubscribe();
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Updates a user's today's completion status in their group's dailyStatus document
 */
export async function updateGroupMemberProgress(
  groupId: string,
  userId: string,
  userName: string,
  userEmail: string,
  isCompleted: boolean,
  completedPercent: number,
  dateStr: string
): Promise<void> {
  const localGroup = LocalDB.getGroup(groupId);
  let finalCompleted = isCompleted;
  let finalPercent = completedPercent;

  if (localGroup) {
    const isEnglishGroup = localGroup.subjectId === "subj_eng" || localGroup.subjectId === "daily_random";
    if (isEnglishGroup) {
      const dailyProgId = `${userId}_daily_random_daily_random_set_${dateStr}`;
      const dailyProg = LocalDB.getProgress(dailyProgId);
      
      const progressMap = LocalDB.getProgressMap();
      const completedWordsSet = new Set<string>();
      Object.values(progressMap).forEach((p) => {
        if (p.uid === userId && p.date === dateStr && (p.subjectId === "subj_eng" || p.subjectId === "daily_random")) {
          if (Array.isArray(p.completedWords)) {
            p.completedWords.forEach(wId => completedWordsSet.add(wId));
          }
        }
      });
      
      const totalWordsCompletedToday = completedWordsSet.size;
      finalCompleted = !!(dailyProg && dailyProg.isCompleted) || totalWordsCompletedToday >= 20;
      finalPercent = finalCompleted ? 100 : Math.round((totalWordsCompletedToday / 20) * 100);
    }

    // Save to yesterday status/today status locally
    const statusKey = `grp_status_${groupId}_${dateStr}`;
    const storedStatus = localStorage.getItem(statusKey);
    let currentStatus: GroupDailyStatus = storedStatus ? JSON.parse(storedStatus) : {
      id: dateStr,
      date: dateStr,
      memberProgress: {},
      isGroupCompleted: false,
      isStreakUpdated: false
    };

    currentStatus.memberProgress[userId] = {
      uid: userId,
      displayName: userName,
      email: userEmail,
      isCompleted: finalCompleted,
      completedPercent: finalPercent
    };

    const isGroupCompletedToday = localGroup.memberIds.every(
      (mId) => currentStatus.memberProgress[mId]?.isCompleted === true
    );
    currentStatus.isGroupCompleted = isGroupCompletedToday;

    localStorage.setItem(statusKey, JSON.stringify(currentStatus));

    // Update streak locally immediately if the whole group completes today
    if (isGroupCompletedToday && localGroup.lastStreakDate !== dateStr) {
      localGroup.currentStreak += 1;
      localGroup.longestStreak = Math.max(localGroup.longestStreak, localGroup.currentStreak);
      localGroup.lastStreakDate = dateStr;
      
      const expectedTokens = getRestoreTokensForStreak(localGroup.currentStreak);
      if (expectedTokens > localGroup.restoreTokensAvailable) {
        localGroup.restoreTokensAvailable = expectedTokens;
      }
      LocalDB.saveGroup(localGroup);
    }

    window.dispatchEvent(new Event("storage"));
  }

  try {
    const dailyStatusRef = doc(db, `groups/${groupId}/dailyStatus`, dateStr);
    const dailyStatusSnap = await getDoc(dailyStatusRef);

    const memberStatus: GroupMemberStatus = {
      uid: userId,
      displayName: userName,
      email: userEmail,
      isCompleted: finalCompleted,
      completedPercent: finalPercent
    };

    const groupRef = doc(db, "groups", groupId);
    const groupSnap = await getDoc(groupRef);
    const groupData = groupSnap.data() as Group;
    const activeMemberIds = groupData?.memberIds || [userId];

    if (dailyStatusSnap.exists()) {
      const currentStatus = dailyStatusSnap.data() as GroupDailyStatus;
      const updatedMemberProgress = {
        ...currentStatus.memberProgress,
        [userId]: memberStatus
      };

      const isGroupCompleted = activeMemberIds.every(
        (mId) => updatedMemberProgress[mId]?.isCompleted === true
      );

      await updateDoc(dailyStatusRef, {
        [`memberProgress.${userId}`]: memberStatus,
        isGroupCompleted
      });

      // Update Group streak immediately in Firestore if completed
      if (isGroupCompleted && groupData && groupData.lastStreakDate !== dateStr) {
        const newStreak = groupData.currentStreak + 1;
        const newLongest = Math.max(groupData.longestStreak, newStreak);
        let newTokens = groupData.restoreTokensAvailable;
        const expectedTokens = getRestoreTokensForStreak(newStreak);
        if (expectedTokens > groupData.restoreTokensAvailable) {
          newTokens = expectedTokens;
        }

        await updateDoc(groupRef, {
          currentStreak: newStreak,
          longestStreak: newLongest,
          restoreTokensAvailable: newTokens,
          lastStreakDate: dateStr
        });
      }
    } else {
      const isGroupCompleted = activeMemberIds.every(
        (mId) => mId === userId ? finalCompleted : false
      );

      await setDoc(dailyStatusRef, {
        id: dateStr,
        date: dateStr,
        memberProgress: {
          [userId]: memberStatus
        },
        isGroupCompleted,
        isStreakUpdated: false
      });

      // Update Group streak immediately in Firestore if completed
      if (isGroupCompleted && groupData && groupData.lastStreakDate !== dateStr) {
        const newStreak = groupData.currentStreak + 1;
        const newLongest = Math.max(groupData.longestStreak, newStreak);
        let newTokens = groupData.restoreTokensAvailable;
        const expectedTokens = getRestoreTokensForStreak(newStreak);
        if (expectedTokens > groupData.restoreTokensAvailable) {
          newTokens = expectedTokens;
        }

        await updateDoc(groupRef, {
          currentStreak: newStreak,
          longestStreak: newLongest,
          restoreTokensAvailable: newTokens,
          lastStreakDate: dateStr
        });
      }
    }
  } catch (error) {
    console.warn("Firestore updateGroupMemberProgress failed, running locally:", error);
  }
}

/**
 * Calculates restore tokens based on reached streak milestone
 */
export function getRestoreTokensForStreak(streak: number): number {
  if (streak >= 150) return 5;
  if (streak >= 100) return 4;
  if (streak >= 50) return 3;
  if (streak >= 20) return 2;
  if (streak >= 10) return 1;
  return 0;
}

/**
 * Evaluates yesterday's streak (or older days) for a group and updates current/longest streaks.
 * This runs automatically on client load of Group Dashboard to avoid cron dependencies.
 */
export async function evaluateGroupStreak(groupId: string, memberIds: string[]): Promise<{ streakUpdated: boolean; statusChanged: string | null }> {
  const localGroup = LocalDB.getGroup(groupId);
  if (localGroup) {
    const todayStr = getVNDateString();
    const yesterdayStr = getVNYesterdayDateString();

    if (localGroup.lastStreakDate !== yesterdayStr && localGroup.lastStreakDate !== todayStr) {
      if (!localGroup.lastStreakDate) {
        localGroup.lastStreakDate = yesterdayStr;
        LocalDB.saveGroup(localGroup);
        window.dispatchEvent(new Event("storage"));
        return { streakUpdated: true, statusChanged: "initialized" };
      }

      // Check yesterday status locally
      const setsForSubject = LocalDB.getVocabularySets().filter(s => s.subjectId === localGroup.subjectId);
      let allCompletedYesterday = false;
      if (setsForSubject.length > 0) {
        allCompletedYesterday = memberIds.every(mId => {
          const progressList = setsForSubject.map(set => {
            const progId = `${mId}_${localGroup.subjectId}_${set.id}_${yesterdayStr}`;
            return LocalDB.getProgress(progId);
          });
          return progressList.every(p => p && p.isCompleted);
        });
      }

      if (allCompletedYesterday) {
        localGroup.currentStreak += 1;
        localGroup.longestStreak = Math.max(localGroup.longestStreak, localGroup.currentStreak);
        localGroup.lastStreakDate = yesterdayStr;
        LocalDB.saveGroup(localGroup);
        window.dispatchEvent(new Event("storage"));
        return { streakUpdated: true, statusChanged: "incremented" };
      } else {
        if (localGroup.currentStreak > 0) {
          localGroup.currentStreak = 0;
          localGroup.lastStreakDate = yesterdayStr;
          LocalDB.saveGroup(localGroup);
          window.dispatchEvent(new Event("storage"));
          return { streakUpdated: true, statusChanged: "broken" };
        } else {
          localGroup.lastStreakDate = yesterdayStr;
          LocalDB.saveGroup(localGroup);
          window.dispatchEvent(new Event("storage"));
          return { streakUpdated: true, statusChanged: "maintained_zero" };
        }
      }
    }
  }

  try {
    const groupRef = doc(db, "groups", groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) return { streakUpdated: false, statusChanged: null };

    const group = groupSnap.data() as Group;
    const todayStr = getVNDateString();
    const yesterdayStr = getVNYesterdayDateString();

    // If lastStreakDate is already yesterday or today, we don't need to process yesterday
    if (group.lastStreakDate === yesterdayStr || group.lastStreakDate === todayStr) {
      return { streakUpdated: false, statusChanged: null };
    }

    // Determine the date we need to evaluate:
    if (!group.lastStreakDate) {
      await updateDoc(groupRef, {
        lastStreakDate: yesterdayStr
      });
      return { streakUpdated: true, statusChanged: "initialized" };
    }

    // We need to evaluate yesterday's completeness
    const yesterdayStatusRef = doc(db, `groups/${groupId}/dailyStatus`, yesterdayStr);
    const yesterdayStatusSnap = await getDoc(yesterdayStatusRef);

    let allCompletedYesterday = false;

    if (yesterdayStatusSnap.exists()) {
      const yesterdayStatus = yesterdayStatusSnap.data() as GroupDailyStatus;
      allCompletedYesterday = memberIds.every(
        (mId) => yesterdayStatus.memberProgress?.[mId]?.isCompleted === true
      );
    } else if (localGroup) {
      // Fallback to local computation
      const isEnglishGroup = localGroup.subjectId === "subj_eng" || localGroup.subjectId === "daily_random";
      if (isEnglishGroup) {
        allCompletedYesterday = memberIds.every(mId => {
          const dailyProgId = `${mId}_daily_random_daily_random_set_${yesterdayStr}`;
          const dailyProg = LocalDB.getProgress(dailyProgId);
          return !!(dailyProg && dailyProg.isCompleted);
        });
      } else {
        const setsForSubject = LocalDB.getVocabularySets().filter(s => s.subjectId === localGroup.subjectId);
        if (setsForSubject.length > 0) {
          allCompletedYesterday = memberIds.every(mId => {
            const progressList = setsForSubject.map(set => {
              const progId = `${mId}_${localGroup.subjectId}_${set.id}_${yesterdayStr}`;
              return LocalDB.getProgress(progId);
            });
            return progressList.every(p => p && p.isCompleted);
          });
        }
      }
    }

    if (allCompletedYesterday) {
      const newStreak = group.currentStreak + 1;
      const newLongest = Math.max(group.longestStreak, newStreak);
      
      let newTokens = group.restoreTokensAvailable;
      const expectedTokens = getRestoreTokensForStreak(newStreak);
      if (expectedTokens > group.restoreTokensAvailable) {
        newTokens = expectedTokens;
      }

      await updateDoc(groupRef, {
        currentStreak: newStreak,
        longestStreak: newLongest,
        restoreTokensAvailable: newTokens,
        lastStreakDate: yesterdayStr
      });

      if (yesterdayStatusSnap.exists()) {
        await updateDoc(yesterdayStatusRef, {
          isStreakUpdated: true,
          isGroupCompleted: true
        });
      } else {
        await setDoc(yesterdayStatusRef, {
          id: yesterdayStr,
          date: yesterdayStr,
          memberProgress: {},
          isGroupCompleted: true,
          isStreakUpdated: true
        });
      }

      return { streakUpdated: true, statusChanged: "incremented" };
    } else {
      if (group.currentStreak > 0) {
        const previousStreakValue = group.currentStreak;
        
        await updateDoc(groupRef, {
          currentStreak: 0,
          lastStreakDate: yesterdayStr
        });

        await setDoc(yesterdayStatusRef, {
          id: yesterdayStr,
          date: yesterdayStr,
          isGroupCompleted: false,
          isStreakUpdated: true,
          previousStreakValue: previousStreakValue
        }, { merge: true });

        return { streakUpdated: true, statusChanged: "broken" };
      } else {
        await updateDoc(groupRef, {
          lastStreakDate: yesterdayStr
        });
        return { streakUpdated: true, statusChanged: "maintained_zero" };
      }
    }
  } catch (error) {
    console.warn("Firestore evaluateGroupStreak failed, running locally instead:", error);
  }

  return { streakUpdated: false, statusChanged: null };
}

/**
 * Restores a broken streak using 1 restore token.
 * This can be clicked by any member of the group when a streak is broken.
 */
export async function restoreGroupStreak(groupId: string): Promise<void> {
  const localGroup = LocalDB.getGroup(groupId);
  if (localGroup) {
    if (localGroup.restoreTokensAvailable > 0) {
      localGroup.currentStreak = 1; // start back at 1
      localGroup.restoreTokensAvailable -= 1;
      LocalDB.saveGroup(localGroup);
      window.dispatchEvent(new Event("storage"));
    }
  }

  try {
    const groupRef = doc(db, "groups", groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) throw new Error("Nhóm không tồn tại!");

    const group = groupSnap.data() as Group;
    if (group.restoreTokensAvailable <= 0) {
      throw new Error("Nhóm của bạn không còn lượt khôi phục chuỗi nào!");
    }

    const yesterdayStr = getVNYesterdayDateString();
    const yesterdayStatusRef = doc(db, `groups/${groupId}/dailyStatus`, yesterdayStr);
    const yesterdayStatusSnap = await getDoc(yesterdayStatusRef);

    let previousStreak = 0;
    if (yesterdayStatusSnap.exists()) {
      const yesterdayData = yesterdayStatusSnap.data();
      previousStreak = yesterdayData.previousStreakValue || 0;
    }

    if (previousStreak === 0) {
      // Fallback: restore to previous longestStreak - 1 (or at least 1)
      previousStreak = Math.max(1, group.longestStreak - 1);
    }

    const restoredStreak = previousStreak + 1;
    const newLongest = Math.max(group.longestStreak, restoredStreak);
    const remainingTokens = group.restoreTokensAvailable - 1;

    await updateDoc(groupRef, {
      currentStreak: restoredStreak,
      longestStreak: newLongest,
      restoreTokensAvailable: remainingTokens
    });

    if (yesterdayStatusSnap.exists()) {
      await updateDoc(yesterdayStatusRef, {
        isGroupCompleted: true,
        previousStreakValue: 0
      });
    } else {
      await setDoc(yesterdayStatusRef, {
        id: yesterdayStr,
        date: yesterdayStr,
        isGroupCompleted: true,
        previousStreakValue: 0,
        isStreakUpdated: true
      });
    }
  } catch (error) {
    console.warn("Firestore restoreGroupStreak failed, updated locally:", error);
  }
}
