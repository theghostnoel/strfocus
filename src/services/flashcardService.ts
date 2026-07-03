import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";
import { Subject, VocabularySet, Progress, Word } from "../types";
import { updateGroupMemberProgress } from "./groupService";
import { LocalDB } from "../utils/localDb";

/**
 * Subscribes to all subjects
 */
export function subscribeToSubjects(callback: (subjects: Subject[]) => void) {
  // Send local storage cached subjects first
  const localSubjects = LocalDB.getSubjects();
  callback(localSubjects);

  const subjCol = collection(db, "subjects");
  
  const unsubscribe = onSnapshot(subjCol, (snapshot) => {
    const list: Subject[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as Subject);
    });
    
    // Save to LocalDB to keep it synchronized!
    list.forEach(sub => LocalDB.saveSubject(sub));
    callback(list.length > 0 ? list : LocalDB.getSubjects());
  }, (error) => {
    console.warn("Firestore subscribeToSubjects error, using LocalDB:", error);
    callback(LocalDB.getSubjects());
  });

  const handleStorage = () => {
    callback(LocalDB.getSubjects());
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    unsubscribe();
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Admin: Adds a new subject
 */
export async function addSubject(name: string): Promise<void> {
  const newId = `subj_${Date.now()}`;
  const newSub: Subject = {
    id: newId,
    name,
    isActive: true
  };

  LocalDB.saveSubject(newSub);
  window.dispatchEvent(new Event("storage"));

  try {
    const subjRef = doc(db, "subjects", newId);
    await setDoc(subjRef, {
      name,
      isActive: true
    });
  } catch (error) {
    console.warn("Firestore addSubject failed, saved locally instead:", error);
  }
}

/**
 * Admin: Updates an existing subject
 */
export async function updateSubject(id: string, name: string, isActive: boolean): Promise<void> {
  const updatedSub: Subject = {
    id,
    name,
    isActive
  };

  LocalDB.saveSubject(updatedSub);
  window.dispatchEvent(new Event("storage"));

  try {
    const subjRef = doc(db, "subjects", id);
    await setDoc(subjRef, {
      name,
      isActive
    });
  } catch (error) {
    console.warn("Firestore updateSubject failed, saved locally instead:", error);
  }
}

/**
 * Admin: Deletes a subject
 */
export async function deleteSubject(id: string): Promise<void> {
  LocalDB.deleteSubject(id);
  window.dispatchEvent(new Event("storage"));

  try {
    const subjRef = doc(db, "subjects", id);
    await deleteDoc(subjRef);
  } catch (error) {
    console.warn("Firestore deleteSubject failed, deleted locally instead:", error);
  }
}

/**
 * Subscribes to all vocabulary sets ordered by creation date
 */
export function subscribeToVocabularySets(callback: (sets: VocabularySet[]) => void) {
  // Send local storage cached sets first so the UI loads instantly!
  const localSets = LocalDB.getVocabularySets();
  callback(localSets);

  const setsCol = collection(db, "vocabularySets");
  const q = query(setsCol, orderBy("createdAt", "desc"));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const sets: VocabularySet[] = [];
    snapshot.forEach((docSnap) => {
      sets.push({ id: docSnap.id, ...docSnap.data() } as VocabularySet);
    });
    
    // Save to LocalDB to keep it synchronized!
    sets.forEach(set => LocalDB.saveVocabularySet(set));
    callback(sets.length > 0 ? sets : LocalDB.getVocabularySets());
  }, (error) => {
    console.warn("Firestore subscribeToVocabularySets error, using LocalDB:", error);
    callback(LocalDB.getVocabularySets());
  });

  // Listen for local changes
  const handleStorage = () => {
    callback(LocalDB.getVocabularySets());
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    unsubscribe();
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Admin: Adds a new vocabulary set
 */
export async function addVocabularySet(title: string, description: string, words: Word[], subjectId: string): Promise<void> {
  const newId = `set_${Date.now()}`;
  const newSet: VocabularySet = {
    id: newId,
    title,
    description,
    words,
    wordsCount: words.length,
    subjectId
  };

  LocalDB.saveVocabularySet(newSet);
  window.dispatchEvent(new Event("storage"));

  try {
    const setsCol = collection(db, "vocabularySets");
    await addDoc(setsCol, {
      title,
      description,
      words,
      wordsCount: words.length,
      subjectId,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Firestore addVocabularySet failed, saved locally instead:", error);
  }
}

/**
 * Admin: Updates an existing vocabulary set
 */
export async function updateVocabularySet(setId: string, title: string, description: string, words: Word[], subjectId: string): Promise<void> {
  const updatedSet: VocabularySet = {
    id: setId,
    title,
    description,
    words,
    wordsCount: words.length,
    subjectId
  };

  LocalDB.saveVocabularySet(updatedSet);
  window.dispatchEvent(new Event("storage"));

  try {
    const setRef = doc(db, "vocabularySets", setId);
    await updateDoc(setRef, {
      title,
      description,
      words,
      wordsCount: words.length,
      subjectId
    });
  } catch (error) {
    console.warn("Firestore updateVocabularySet failed, saved locally instead:", error);
  }
}

/**
 * Admin: Deletes a vocabulary set
 */
export async function deleteVocabularySet(setId: string): Promise<void> {
  LocalDB.deleteVocabularySet(setId);
  window.dispatchEvent(new Event("storage"));

  try {
    const setRef = doc(db, "vocabularySets", setId);
    await deleteDoc(setRef);
  } catch (error) {
    console.warn("Firestore deleteVocabularySet failed, deleted locally instead:", error);
  }
}

/**
 * Subscribes to a student's progress for a specific vocabulary set on a specific day
 */
export function subscribeToProgress(
  uid: string,
  subjectId: string,
  setId: string,
  dateStr: string,
  callback: (progress: Progress | null) => void
) {
  const progressId = `${uid}_${subjectId}_${setId}_${dateStr}`;
  
  // Call immediately with local data
  const localProgress = LocalDB.getProgress(progressId);
  callback(localProgress);

  const progressRef = doc(db, "progress", progressId);

  const unsubscribe = onSnapshot(progressRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as Progress;
      LocalDB.saveProgress(data);
      callback(data);
    } else {
      callback(LocalDB.getProgress(progressId));
    }
  }, (error) => {
    console.warn("Firestore subscribeToProgress failed, using local progress:", error);
    callback(LocalDB.getProgress(progressId));
  });

  const handleStorage = () => {
    callback(LocalDB.getProgress(progressId));
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    unsubscribe();
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Initializes or updates student progress on a vocabulary set
 */
export async function updateProgress(
  uid: string,
  displayName: string,
  email: string,
  groupIds: string[],
  subjectId: string,
  setId: string,
  dateStr: string,
  completedWords: string[],
  incorrectWords: string[],
  totalWordsCount: number
): Promise<void> {
  const progressId = `${uid}_${subjectId}_${setId}_${dateStr}`;
  const completedPercent = totalWordsCount > 0 ? Math.round((completedWords.length / totalWordsCount) * 100) : 0;
  const isCompleted = completedWords.length === totalWordsCount && totalWordsCount > 0;

  const progressData: Progress = {
    id: progressId,
    uid,
    subjectId,
    setId,
    date: dateStr,
    completedWords,
    incorrectWords,
    completedPercent,
    isCompleted,
    updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 } as any
  };

  LocalDB.saveProgress(progressData);
  window.dispatchEvent(new Event("storage"));

  try {
    const progressRef = doc(db, "progress", progressId);
    await setDoc(progressRef, progressData);
  } catch (error) {
    console.warn("Firestore updateProgress failed, saved locally instead:", error);
  }

  // Update in matched group daily trackers
  for (const groupId of groupIds) {
    const localGroup = LocalDB.getGroup(groupId);
    if (localGroup && localGroup.subjectId === subjectId) {
      try {
        await updateGroupMemberProgress(
          groupId,
          uid,
          displayName,
          email,
          isCompleted,
          completedPercent,
          dateStr
        );
      } catch (error) {
        console.warn(`updateGroupMemberProgress failed for group ${groupId}, processing locally:`, error);
      }
    }
  }
}
