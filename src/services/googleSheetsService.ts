import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Word } from "../types";
import { getVNDateString } from "../utils/timezone";

export interface ImportedWord extends Word {
  stt: number;
}

export interface SheetsConfig {
  sheetUrl: string;
  totalWords: number;
  importedAt: any;
  totalChunks: number;
}

export interface DailyState {
  currentDate: string;
  activeWords: ImportedWord[];
  shownSTTs: number[];
  lastResetAt: any;
}

/**
 * Extracts spreadsheet ID and formats to CSV export URL.
 */
export function convertToCSVUrl(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error("Đường dẫn Google Sheets không hợp lệ. Vui lòng kiểm tra lại cấu trúc link!");
  }
  const spreadsheetId = match[1];
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
}

/**
 * Robust CSV parser that handles:
 * - Comma separators
 * - Quotes enclosing text containing commas or newlines
 * - Escaped double quotes ("")
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // Skip the next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal.trim());
      currentVal = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip \n
      }
      row.push(currentVal.trim());
      if (row.length > 0 && row.some(cell => cell !== "")) {
        lines.push(row);
      }
      row = [];
      currentVal = "";
    } else {
      currentVal += char;
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    if (row.some(cell => cell !== "")) {
      lines.push(row);
    }
  }
  return lines;
}

/**
 * Reads data from Google Sheets, parses it, writes 200-word chunks into Firestore 'imported_chunks',
 * and triggers a daily reset immediately with the new vocab pool.
 */
export async function importGoogleSheets(sheetUrl: string): Promise<number> {
  const csvUrl = convertToCSVUrl(sheetUrl);
  const response = await fetch(csvUrl);
  if (!response.ok) {
    throw new Error(
      "Không thể tải dữ liệu từ Google Sheets. Đảm bảo sheet của bạn đã được cấu hình chia sẻ CÔNG KHAI (Bất kỳ ai có liên kết cũng có thể xem)!"
    );
  }

  const text = await response.text();
  const rows = parseCSV(text);

  if (rows.length < 2) {
    throw new Error("Google Sheets trống hoặc không đủ dữ liệu. Vui lòng kiểm tra lại!");
  }

  // Detect and skip header row
  const hasHeader = isNaN(Number(rows[0][0].trim()));
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const importedWords: ImportedWord[] = dataRows
    .map((row) => {
      const sttVal = row[0]?.trim();
      const stt = Number(sttVal);
      if (isNaN(stt) || !row[1]) return null;

      return {
        id: `daily_w_${stt}`,
        stt,
        english: row[1]?.trim() || "",
        phonetic: row[2]?.trim() || "",
        vietnamese: row[3]?.trim() || "",
        example: row[4]?.trim() || "",
        exampleTranslate: row[5]?.trim() || ""
      } as ImportedWord;
    })
    .filter((w): w is ImportedWord => w !== null);

  if (importedWords.length === 0) {
    throw new Error("Không thể trích xuất được từ vựng nào hợp lệ. Đảm bảo cột 1 là số thứ tự (STT) và cột 2 là Từ vựng.");
  }

  // Segment and write to Firestore in chunks of 200 to optimize quotas
  const chunkSize = 200;
  const totalChunks = Math.ceil(importedWords.length / chunkSize);

  for (let c = 0; c < totalChunks; c++) {
    const start = c * chunkSize;
    const end = start + chunkSize;
    const chunkWords = importedWords.slice(start, end);

    const chunkRef = doc(db, "imported_chunks", `chunk_${c}`);
    await setDoc(chunkRef, {
      chunkIndex: c,
      words: chunkWords
    });
  }

  // Save sheets configuration metadata
  const configRef = doc(db, "config", "daily_sheets");
  await setDoc(configRef, {
    sheetUrl,
    totalWords: importedWords.length,
    totalChunks,
    importedAt: serverTimestamp()
  });

  // Force perform random selection right after importing to refresh today's list!
  await performRandomSelection(importedWords, []);

  return importedWords.length;
}

/**
 * Fetches all chunks of imported words from Firestore
 */
export async function fetchAllImportedWords(): Promise<ImportedWord[]> {
  const configRef = doc(db, "config", "daily_sheets");
  const configSnap = await getDoc(configRef);
  if (!configSnap.exists()) {
    return [];
  }
  const config = configSnap.data() as SheetsConfig;
  const totalChunks = config.totalChunks;

  const allWords: ImportedWord[] = [];
  for (let c = 0; c < totalChunks; c++) {
    const chunkRef = doc(db, "imported_chunks", `chunk_${c}`);
    const snap = await getDoc(chunkRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && Array.isArray(data.words)) {
        allWords.push(...data.words);
      }
    }
  }
  return allWords.sort((a, b) => a.stt - b.stt);
}

/**
 * Checks if a daily reset is needed (by comparing Vietnam timezone date YYYY-MM-DD).
 * Performs a random selection of 20 non-repeating words if the day has changed or if forced.
 */
export async function checkAndTriggerDailyReset(forceReset = false): Promise<DailyState | null> {
  const stateRef = doc(db, "config", "daily_state");
  const stateSnap = await getDoc(stateRef);

  const todayStr = getVNDateString(); // ICT/UTC+7 formatted string: YYYY-MM-DD

  if (stateSnap.exists() && !forceReset) {
    const state = stateSnap.data() as DailyState;
    if (state.currentDate === todayStr && Array.isArray(state.activeWords) && state.activeWords.length > 0) {
      // Already initialized for today
      return state;
    }
  }

  // Time to reset or initialize!
  const allWords = await fetchAllImportedWords();
  if (allWords.length === 0) {
    return null; // Sheets pool is empty / not imported yet
  }

  let shownSTTs: number[] = [];
  if (stateSnap.exists()) {
    const existingState = stateSnap.data() as DailyState;
    shownSTTs = Array.isArray(existingState.shownSTTs) ? existingState.shownSTTs : [];
  }

  return await performRandomSelection(allWords, shownSTTs);
}

/**
 * Selects 20 random words excluding those in shownSTTs.
 * If less than 20 available, resets the cycle history to start fresh.
 */
async function performRandomSelection(allWords: ImportedWord[], shownSTTs: number[]): Promise<DailyState> {
  const todayStr = getVNDateString();

  // Filter words not shown yet
  let availableWords = allWords.filter((w) => !shownSTTs.includes(w.stt));

  // If we don't have enough words left to select 20, clear history and restart the cycle
  if (availableWords.length < 20) {
    shownSTTs = [];
    availableWords = [...allWords];
  }

  // Shuffle available words
  const shuffled = [...availableWords].sort(() => 0.5 - Math.random());
  const selectedWords = shuffled.slice(0, Math.min(20, shuffled.length));

  // Update history with selected word STTs
  const newShownSTTs = [...shownSTTs, ...selectedWords.map((w) => w.stt)];

  const newState: DailyState = {
    currentDate: todayStr,
    activeWords: selectedWords,
    shownSTTs: newShownSTTs,
    lastResetAt: new Date().toISOString()
  };

  const stateRef = doc(db, "config", "daily_state");
  await setDoc(stateRef, {
    currentDate: newState.currentDate,
    activeWords: newState.activeWords,
    shownSTTs: newState.shownSTTs,
    lastResetAt: serverTimestamp()
  });

  return newState;
}
