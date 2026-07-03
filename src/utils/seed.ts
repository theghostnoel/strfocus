import { collection, getDocs, addDoc, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { db } from "../firebase";
import { Word } from "../types";

const DEFAULT_SETS = [
  {
    title: "Ngày 1: Động Từ Giao Tiếp Thông Dụng",
    description: "Bộ từ vựng cơ bản giúp bạn tự tin giao tiếp và diễn đạt ý muốn trong các tình huống hàng ngày.",
    words: [
      {
        id: "w1_1",
        english: "Achieve",
        vietnamese: "Đạt được, giành được (sau nỗ lực)",
        example: "She worked hard to achieve her goals.",
        phonetic: "/əˈtʃiːv/"
      },
      {
        id: "w1_2",
        english: "Communicate",
        vietnamese: "Giao tiếp, truyền đạt",
        example: "Good leaders know how to communicate effectively.",
        phonetic: "/kəˈmjuːnɪkeɪt/"
      },
      {
        id: "w1_3",
        english: "Improve",
        vietnamese: "Cải thiện, nâng cao",
        example: "I want to improve my English speaking skills.",
        phonetic: "/ɪmˈpruːv/"
      },
      {
        id: "w1_4",
        english: "Encourage",
        vietnamese: "Khuyến khích, động viên",
        example: "My parents always encourage me to try new things.",
        phonetic: "/ɪnˈkʌrɪdʒ/"
      },
      {
        id: "w1_5",
        english: "Incorporate",
        vietnamese: "Kết hợp, sáp nhập",
        example: "We should incorporate new ideas into our project.",
        phonetic: "/ɪnˈkɔːrpəreɪt/"
      },
      {
        id: "w1_6",
        english: "Explain",
        vietnamese: "Giải thích, thanh minh",
        example: "Can you explain this grammar rule to me again?",
        phonetic: "/ɪkˈspleɪn/"
      },
      {
        id: "w1_7",
        english: "Recommend",
        vietnamese: "Khuyến nghị, giới thiệu",
        example: "Which restaurant do you recommend for dinner?",
        phonetic: "/ˌrekəˈmend/"
      },
      {
        id: "w1_8",
        english: "Understand",
        vietnamese: "Hiểu, thấu hiểu",
        example: "Do you understand the importance of group work?",
        phonetic: "/ˌʌndərˈstænd/"
      }
    ]
  },
  {
    title: "Ngày 2: Tiếng Anh Công Sở & Công Việc",
    description: "Bộ từ vựng tiếng Anh giao tiếp chuyên nghiệp dùng trong văn phòng, cuộc họp và công việc.",
    words: [
      {
        id: "w2_1",
        english: "Collaborate",
        vietnamese: "Hợp tác, cộng tác",
        example: "Researchers from around the world collaborate on this study.",
        phonetic: "/kəˈlæbəreɪt/"
      },
      {
        id: "w2_2",
        english: "Deadline",
        vietnamese: "Hạn chót, thời hạn cuối cùng",
        example: "The deadline for the report is this Friday.",
        phonetic: "/ˈdedlaɪn/"
      },
      {
        id: "w2_3",
        english: "Negotiate",
        vietnamese: "Đàm phán, thương lượng",
        example: "He managed to negotiate a better salary.",
        phonetic: "/nɪˈɡəʊʃieɪt/"
      },
      {
        id: "w2_4",
        english: "Productivity",
        vietnamese: "Năng suất, hiệu suất làm việc",
        example: "A clean workspace can boost your productivity.",
        phonetic: "/ˌprɒdʌkˈtɪvəti/"
      },
      {
        id: "w2_5",
        english: "Coordinate",
        vietnamese: "Phối hợp, điều phối",
        example: "We need to coordinate our efforts to launch the app.",
        phonetic: "/kəʊˈɔːrdɪneɪt/"
      },
      {
        id: "w2_6",
        english: "Implement",
        vietnamese: "Triển khai, thực hiện",
        example: "The company will implement new working hours next month.",
        phonetic: "/ˈɪmplɪment/"
      }
    ]
  },
  {
    title: "Ngày 3: Giao Tiếp Thường Nhật (Daily Routine)",
    description: "Những cụm từ và từ vựng thông dụng dùng trong sinh hoạt và thói quen hàng ngày.",
    words: [
      {
        id: "w3_1",
        english: "Appreciate",
        vietnamese: "Trân trọng, đánh giá cao",
        example: "I highly appreciate your help with my homework.",
        phonetic: "/əˈpriːʃieɪt/"
      },
      {
        id: "w3_2",
        english: "Apologize",
        vietnamese: "Xin lỗi (một cách trang trọng)",
        example: "I apologize for being late to the meeting.",
        phonetic: "/əˈpɒlədʒaɪz/"
      },
      {
        id: "w3_3",
        english: "Familiar",
        vietnamese: "Quen thuộc, thân quen",
        example: "His face looks familiar, but I can't remember his name.",
        phonetic: "/fəˈmɪliər/"
      },
      {
        id: "w3_4",
        english: "Schedule",
        vietnamese: "Lịch trình, thời khóa biểu",
        example: "Let me check my schedule before booking the flight.",
        phonetic: "/ˈʃedjuːl/"
      },
      {
        id: "w3_5",
        english: "Habit",
        vietnamese: "Thói quen",
        example: "Reading books before sleeping is a healthy habit.",
        phonetic: "/ˈhæbɪt/"
      }
    ]
  }
];

export async function seedVocabularySetsIfNeeded() {
  try {
    const vocabCol = collection(db, "vocabularySets");
    const snapshot = await getDocs(vocabCol);
    
    if (snapshot.empty) {
      console.log("No vocabulary sets found. Seeding default sets...");
      for (const set of DEFAULT_SETS) {
        await addDoc(vocabCol, {
          title: set.title,
          description: set.description,
          words: set.words,
          wordsCount: set.words.length,
          createdAt: serverTimestamp()
        });
      }
      console.log("Vocabulary sets seeded successfully!");
    } else {
      console.log("Vocabulary sets already exist in database.");
    }
  } catch (error) {
    console.error("Error seeding vocabulary sets: ", error);
  }
}
