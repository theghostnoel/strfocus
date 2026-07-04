import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { CommunitySettings } from "../types";
import { LocalDB } from "../utils/localDb";

/**
 * Subscribes to real-time community settings in Firestore
 */
export function subscribeToCommunitySettings(callback: (settings: CommunitySettings) => void) {
  // Always trigger immediately with locally saved settings
  const localSettings = LocalDB.getCommunitySettings();
  callback(localSettings);

  const settingsRef = doc(db, "settings", "community");

  const unsubscribe = onSnapshot(
    settingsRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as CommunitySettings;
        // Merge with default values in case some fields are missing
        const merged: CommunitySettings = {
          zaloUrl: data.zaloUrl !== undefined ? data.zaloUrl : localSettings.zaloUrl,
          zaloTitle: data.zaloTitle !== undefined ? data.zaloTitle : localSettings.zaloTitle,
          zaloDesc: data.zaloDesc !== undefined ? data.zaloDesc : localSettings.zaloDesc,
          zaloActive: data.zaloActive !== undefined ? data.zaloActive : (localSettings.zaloActive !== undefined ? localSettings.zaloActive : true),
          discordUrl: data.discordUrl !== undefined ? data.discordUrl : localSettings.discordUrl,
          discordTitle: data.discordTitle !== undefined ? data.discordTitle : localSettings.discordTitle,
          discordDesc: data.discordDesc !== undefined ? data.discordDesc : localSettings.discordDesc,
          discordActive: data.discordActive !== undefined ? data.discordActive : (localSettings.discordActive !== undefined ? localSettings.discordActive : true),
          facebookUrl: data.facebookUrl !== undefined ? data.facebookUrl : localSettings.facebookUrl,
          facebookTitle: data.facebookTitle !== undefined ? data.facebookTitle : localSettings.facebookTitle,
          facebookDesc: data.facebookDesc !== undefined ? data.facebookDesc : localSettings.facebookDesc,
          facebookActive: data.facebookActive !== undefined ? data.facebookActive : (localSettings.facebookActive !== undefined ? localSettings.facebookActive : true),
        };
        LocalDB.saveCommunitySettings(merged);
        callback(merged);
      } else {
        // Document does not exist yet (e.g. brand new DB), we can publish default values to DB
        // but still return local settings
        callback(localSettings);
      }
    },
    (error) => {
      console.warn("Firestore subscribeToCommunitySettings error, using local fallback:", error);
      callback(LocalDB.getCommunitySettings());
    }
  );

  const handleStorage = () => {
    callback(LocalDB.getCommunitySettings());
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    unsubscribe();
    window.removeEventListener("storage", handleStorage);
  };
}

/**
 * Admin: Updates community settings in Firestore
 */
export async function updateCommunitySettings(settings: CommunitySettings): Promise<void> {
  LocalDB.saveCommunitySettings(settings);
  window.dispatchEvent(new Event("storage"));

  try {
    const settingsRef = doc(db, "settings", "community");
    await setDoc(settingsRef, settings);
  } catch (error) {
    console.warn("Firestore updateCommunitySettings failed, saved locally instead:", error);
    throw error;
  }
}
