/* ===========================
   WordMaster / script.js
   Полная версия (часть 1/3)
   =========================== */

/* ---------- Firebase ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyCxF72eHVr7RF3xU3f1NX0mMCRAbwnPKq0",
  authDomain: "english-ce0d5.firebaseapp.com",
  projectId: "english-ce0d5",
  storageBucket: "english-ce0d5.firebasestorage.app",
  messagingSenderId: "773333270606",
  appId: "1:773333270606:web:42c851c40061634b80031f",
  measurementId: "G-NR6GGJDRQ0",
};

let db = null;

/* ---------- Глобальные данные ---------- */
let userWords = [];
let userProgress = {
  streak: 0,
  totalWordsLearned: 0,
  xp: 0,
  lastStudyDate: null,
};

let currentStudyWords = [];
let currentStudyIndex = 0;

let currentQuizWord = null;
let selectedQuizOption = null;

let currentTask = null;

const OPENROUTER_API_KEY =
  "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";

/* ---------- DOM элементы (строго по твоему HTML) ---------- */
const elements = {
  /* вкладки */
  tabs: document.querySelectorAll(".tab"),
  tabContents: document.querySelectorAll(".tab-content"),

  /* уведомления */
  notification: document.querySelector(".notification"),
  notificationText: document.getElementById("notification-text"),

  /* прогресс-виджеты */
  streakValue: document.getElementById("streak-value"),
  wordsCount: document.getElementById("words-count"),
  xpValue: document.getElementById("xp-value"),
  progressValue: document.getElementById("progress-value"),
  progressFill: document.getElementById("progress-fill"),

  /* study */
  studyInfo: document.getElementById("study-info"),
  studyWord: document.getElementById("study-word"),
  studyTranslation: document.getElementById("study-translation"),
  studyExample: document.getElementById("study-example"),
  studyExampleTranslation: document.getElementById("study-example-translation"),
  studyContainer: document.getElementById("study-container"),
  studyProgressText: document.getElementById("study-progress-text"),
  studyProgressBar: document.getElementById("study-progress-bar"),

  /* quiz */
  quizWord: document.getElementById("quiz-word"),
  quizOptions: document.getElementById("quiz-options"),

  /* tasks */
  taskContainer: document.getElementById("task-container"),
  taskText: document.getElementById("task-text"),
  taskInput: document.getElementById("task-input"),
  taskInfo: document.getElementById("task-info"),

  /* words */
  wordsList: document.getElementById("words-list"),
  wordsInfo: document.getElementById("words-info"),
  searchWords: document.getElementById("search-words"),
  sortWords: document.getElementById("sort-words"),

  /* add */
  englishWord: document.getElementById("english-word"),
  russianWord: document.getElementById("russian-word"),
  wordCategory: document.getElementById("word-category"),
  newCategory: document.getElementById("new-category"),
  excelUpload: document.getElementById("excel-upload"),
};

/* ---------- Утилиты ---------- */
function showNotification(message, type = "success") {
  elements.notificationText.textContent = message;
  elements.notification.className = `notification notification-${type} show`;
  setTimeout(() => elements.notification.classList.remove("show"), 3000);
}

function isoToday() {
  return new Date().toISOString().split("T")[0];
}

function toLocalDateString(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString("ru-RU");
  } catch {
    return "-";
  }
}

function randOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function ensureProgressDoc() {
  return db
    .collection("userProgress")
    .doc("user1")
    .get()
    .then(async (doc) => {
      if (!doc.exists) {
        await db.collection("userProgress").doc("user1").set(userProgress);
        return userProgress;
      }
      return doc.data();
    });
}

/* ---------- Инициализация ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
  } catch (e) {
    console.error("Firebase init failed:", e);
    showNotification("Ошибка инициализации Firebase", "error");
    return;
  }

  initializeEventListeners();
  await loadUserData();

  // Авто-инициализация активной вкладки
  const activeTab =
    document.querySelector(".tab.active")?.dataset.tab || "study";
  switchTab(activeTab);
});

/* ---------- Слушатели ---------- */
function initializeEventListeners() {
  // вкладки
  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Study
  document
    .getElementById("start-study")
    .addEventListener("click", () => startStudySession(false));
  document
    .getElementById("repeat-any")
    .addEventListener("click", () => startStudySession(true));
  document
    .getElementById("reset-study")
    .addEventListener("click", resetStudyProgress);
  document
    .getElementById("show-translation")
    .addEventListener("click", showTranslation);
  document
    .getElementById("show-example")
    .addEventListener("click", showExample);
  document
    .getElementById("show-example-translation")
    .addEventListener("click", showExampleTranslation);
  document
    .getElementById("pronounce-example")
    .addEventListener("click", pronounceExample);
  document
    .getElementById("know-word")
    .addEventListener("click", () => handleStudyResponse(true));
  document
    .getElementById("dont-know")
    .addEventListener("click", () => handleStudyResponse(false));
  document.getElementById("pronounce-word").addEventListener("click", () => {
    const word = elements.studyWord.textContent?.trim();
    if (word) pronounceWord(word);
  });

  // Quiz
  document
    .getElementById("new-quiz")
    .addEventListener("click", () => initQuiz(false));
  document
    .getElementById("repeat-any-quiz")
    .addEventListener("click", () => initQuiz(true));
  document
    .getElementById("check-answer")
    .addEventListener("click", checkQuizAnswer);
  // две кнопки «произнести» — рядом со словом и нижняя
  document
    .getElementById("pronounce-quiz-word")
    .addEventListener("click", pronounceQuizWord);
  document
    .getElementById("pronounce-quiz-word-btn")
    .addEventListener("click", pronounceQuizWord);

  elements.quizOptions.addEventListener("click", (e) => {
    const option = e.target.closest(".quiz-option");
    if (!option) return;
    elements.quizOptions
      .querySelectorAll(".quiz-option")
      .forEach((o) => o.classList.remove("selected"));
    option.classList.add("selected");
    selectedQuizOption = option;
  });

  // Tasks
  document
    .getElementById("generate-task")
    .addEventListener("click", generateTask);
  document
    .getElementById("check-task")
    .addEventListener("click", checkTaskAnswer);

  // Words
  elements.wordsList.addEventListener("click", (e) => {
    const btn = e.target.closest(".word-action, .toggle-arrow");
    const card = e.target.closest(".word-card");
    if (!btn || !card) return;
    const wordId = btn.dataset.id;

    if (btn.classList.contains("delete-word")) {
      deleteWord(wordId);
    } else if (btn.classList.contains("toggle-learned")) {
      toggleWordLearned(wordId);
    } else if (btn.classList.contains("pronounce-word")) {
      const word = userWords.find((w) => w.id === wordId);
      if (word) pronounceWord(word.english);
    } else if (btn.classList.contains("toggle-arrow")) {
      card.classList.toggle("expanded");
    }
  });
  elements.searchWords.addEventListener("input", searchWords);
  elements.sortWords.addEventListener("change", sortWords);

  // Add
  document.getElementById("add-word-btn").addEventListener("click", addWord);
  elements.wordCategory.addEventListener("change", () => {
    elements.newCategory.style.display =
      elements.wordCategory.value === "new" ? "block" : "none";
  });

  // Excel
  document
    .getElementById("excel-import-btn")
    .addEventListener("click", () => elements.excelUpload.click());
  elements.excelUpload.addEventListener("change", handleExcelUpload);
}

/* ---------- Переключение вкладок ---------- */
function switchTab(tabId) {
  elements.tabs.forEach((t) => t.classList.remove("active"));
  elements.tabContents.forEach((c) => c.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${tabId}"]`)?.classList.add("active");
  document.getElementById(`${tabId}-tab`)?.classList.add("active");

  if (tabId === "quiz") {
    initQuiz(false);
  } else if (tabId === "words") {
    renderWordsList(userWords);
  } else if (tabId === "tasks") {
    elements.taskText.textContent =
      'Нажмите "Сгенерировать задание" для начала.';
    elements.taskInput.value = "";
    elements.taskInfo.textContent = "";
  }
}

/* ---------- Загрузка данных ---------- */
async function loadUserData() {
  try {
    const wordsSnapshot = await db.collection("words").get();
    userWords = wordsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // гарантируем поле в нижнем регистре для удобных проверок
        englishLower: (data.english || "").toString().trim().toLowerCase(),
        russianLower: (data.russian || "").toString().trim().toLowerCase(),
      };
    });

    const progressData = await ensureProgressDoc();
    userProgress = {
      streak: progressData.streak || 0,
      totalWordsLearned: progressData.totalWordsLearned || 0,
      xp: progressData.xp || 0,
      lastStudyDate: progressData.lastStudyDate || null,
    };

    updateProgressUI();
    updateCategoryDropdown();
    renderWordsList(userWords);
    showNotification("Данные загружены!");
  } catch (error) {
    console.error("Error loading user data:", error);
    showNotification("Ошибка загрузки данных", "error");
  }
}

/* ---------- UI прогресса ---------- */
function updateProgressUI() {
  elements.streakValue.textContent = userProgress.streak || 0;
  elements.wordsCount.textContent = userProgress.totalWordsLearned || 0;
  elements.xpValue.textContent = userProgress.xp || 0;

  const progressPercent = userWords.length
    ? Math.round((userProgress.totalWordsLearned / userWords.length) * 100)
    : 0;

  elements.progressValue.textContent = `${progressPercent}%`;
  elements.progressFill.style.width = `${progressPercent}%`;
}
/* ===========================
   WordMaster / script.js
   Полная версия (часть 2/3)
   =========================== */

/* ---------- Работа со словами ---------- */
async function addWord() {
  const english = elements.englishWord.value.trim();
  const russian = elements.russianWord.value.trim();
  let category = elements.wordCategory.value;

  if (!english || !russian) {
    showNotification("Заполните обязательные поля!", "error");
    return;
  }
  if (category === "new") {
    category = elements.newCategory.value.trim();
    if (!category) {
      showNotification("Введите название новой категории!", "error");
      return;
    }
  }

  const payload = {
    english,
    russian,
    category: category || "uncategorized",
    example: "",
    exampleSentence: "",
    exampleTranslation: "",
    learned: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    reviewInterval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    lastReviewed: null,
  };

  try {
    const ref = await db.collection("words").add(payload);
    userWords.push({
      id: ref.id,
      ...payload,
      createdAt: { seconds: Date.now() / 1000 },
    });
    // очистка формы
    elements.englishWord.value = "";
    elements.russianWord.value = "";
    elements.wordCategory.value = "";
    elements.newCategory.value = "";
    elements.newCategory.style.display = "none";

    updateCategoryDropdown();
    renderWordsList(userWords);
    showNotification("Слово успешно добавлено!");
  } catch (e) {
    console.error("Error adding word:", e);
    showNotification("Ошибка при добавлении слова", "error");
  }
}

async function deleteWord(wordId) {
  if (!confirm("Удалить это слово?")) return;
  try {
    await db.collection("words").doc(wordId).delete();
    userWords = userWords.filter((w) => w.id !== wordId);
    renderWordsList(userWords);
    showNotification("Слово удалено");
  } catch (e) {
    console.error("Error deleting word:", e);
    showNotification("Ошибка при удалении", "error");
  }
}

async function toggleWordLearned(wordId) {
  try {
    const word = userWords.find((w) => w.id === wordId);
    if (!word) return;
    const newLearned = !word.learned;

    await db.collection("words").doc(wordId).update({ learned: newLearned });

    // обновляем счётчики
    if (newLearned) {
      await addXP(5);
      userProgress.totalWordsLearned++;
    } else {
      userProgress.totalWordsLearned = Math.max(
        0,
        (userProgress.totalWordsLearned || 0) - 1
      );
    }

    await db.collection("userProgress").doc("user1").set(
      {
        totalWordsLearned: userProgress.totalWordsLearned,
      },
      { merge: true }
    );

    word.learned = newLearned;
    updateProgressUI();
    renderWordsList(userWords);
    showNotification(
      newLearned ? "Отмечено как изученное" : "Отмечено как неизученное"
    );
  } catch (e) {
    console.error("Error toggle learned:", e);
    showNotification("Ошибка при изменении статуса", "error");
  }
}

async function markWordAsLearned(wordId) {
  try {
    const word = userWords.find((w) => w.id === wordId);
    if (!word || word.learned) return;

    await db.collection("words").doc(wordId).update({ learned: true });
    word.learned = true;

    userProgress.totalWordsLearned = (userProgress.totalWordsLearned || 0) + 1;
    await db
      .collection("userProgress")
      .doc("user1")
      .set(
        { totalWordsLearned: userProgress.totalWordsLearned },
        { merge: true }
      );
  } catch (e) {
    console.error("markWordAsLearned error:", e);
    showNotification("Ошибка при отметке слова", "error");
  }
}

async function addXP(points) {
  try {
    userProgress.xp = (userProgress.xp || 0) + points;
    await db
      .collection("userProgress")
      .doc("user1")
      .set({ xp: userProgress.xp }, { merge: true });
    updateProgressUI();
  } catch (e) {
    console.error("addXP error:", e);
    showNotification("Ошибка при добавлении опыта", "error");
  }
}

/* ---------- Список, сортировка, поиск ---------- */
function renderWordsList(words) {
  elements.wordsList.innerHTML = "";
  const today = isoToday();
  let dueWords = 0;

  if (!words || words.length === 0) {
    elements.wordsList.innerHTML = `<div class="empty-state">Список пуст. Добавьте слова.</div>`;
    elements.wordsInfo.textContent = `Слов для повторения сегодня: 0. Всего слов: 0.`;
    return;
  }

  words.forEach((word) => {
    const lastReviewed = word.lastReviewed ? new Date(word.lastReviewed) : null;
    let nextReviewText = "Готово к повторению";
    if (lastReviewed) {
      const next = new Date(lastReviewed);
      next.setDate(lastReviewed.getDate() + (word.reviewInterval || 1));
      if (next.toISOString().split("T")[0] <= today) {
        dueWords++;
      } else {
        nextReviewText = next.toLocaleDateString("ru-RU");
      }
    } else {
      dueWords++;
    }

    const card = document.createElement("div");
    card.className = `word-card ${word.learned ? "learned" : ""}`;
    card.innerHTML = `
      <div class="word-header">
        <div class="word-text">${word.english}</div>
        <div class="word-actions">
          <button class="word-action pronounce-word" data-id="${
            word.id
          }" title="Произнести">
            <i class="fas fa-volume-up"></i>
          </button>
          <button class="toggle-arrow" data-id="${
            word.id
          }" title="Показать детали">
            <i class="fas fa-chevron-down"></i>
          </button>
        </div>
      </div>
      <div class="word-details">
        <div class="word-translation">Перевод: ${word.russian}</div>
        ${
          word.exampleSentence
            ? `<div class="word-example">Пример: ${word.exampleSentence}</div>`
            : word.example
            ? `<div class="word-example">Пример: ${word.example}</div>`
            : ""
        }
        ${
          word.exampleTranslation
            ? `<div class="word-example-translation">Перевод примера: ${word.exampleTranslation}</div>`
            : ""
        }
        <div class="word-next-review">Следующий повтор: ${nextReviewText}</div>
        <div class="word-actions">
          <button class="word-action toggle-learned" data-id="${
            word.id
          }" title="${
      word.learned ? "Сделать неизученным" : "Сделать изученным"
    }">
            <i class="fas ${word.learned ? "fa-undo" : "fa-check"}"></i>
          </button>
          <button class="word-action delete-word" data-id="${
            word.id
          }" title="Удалить">
            <i class="fas fa-trash"></i>
          </button>
          ${
            word.category
              ? `<div class="word-category">${word.category}</div>`
              : ""
          }
        </div>
      </div>
    `;
    elements.wordsList.appendChild(card);
  });

  elements.wordsInfo.textContent = `Слов для повторения сегодня: ${dueWords}. Всего слов: ${words.length}.`;
}

function searchWords() {
  sortWords();
}

function sortWords() {
  const sortType = elements.sortWords.value;
  const searchTerm = elements.searchWords.value.trim().toLowerCase();

  let list = [...userWords];

  if (searchTerm) {
    list = list.filter(
      (w) =>
        w.english.toLowerCase().includes(searchTerm) ||
        w.russian.toLowerCase().includes(searchTerm) ||
        (w.category && w.category.toLowerCase().includes(searchTerm))
    );
  }

  switch (sortType) {
    case "added-desc":
      list.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );
      break;
    case "added-asc":
      list.sort(
        (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
      );
      break;
    case "alpha-asc":
      list.sort((a, b) => a.english.localeCompare(b.english));
      break;
    case "alpha-desc":
      list.sort((a, b) => b.english.localeCompare(a.english)); // FIX
      break;
    case "learned":
      list.sort((a, b) => (b.learned ? 1 : 0) - (a.learned ? 1 : 0));
      break;
    case "unlearned":
      list.sort((a, b) => (a.learned ? 1 : 0) - (b.learned ? 1 : 0));
      break;
    case "review-soon":
      list.sort((a, b) => {
        const aDate = a.lastReviewed
          ? new Date(a.lastReviewed).setDate(
              new Date(a.lastReviewed).getDate() + (a.reviewInterval || 1)
            )
          : 0;
        const bDate = b.lastReviewed
          ? new Date(b.lastReviewed).setDate(
              new Date(b.lastReviewed).getDate() + (b.reviewInterval || 1)
            )
          : 0;
        return aDate - bDate;
      });
      break;
  }

  renderWordsList(list);
}

function updateCategoryDropdown() {
  const categories = [
    ...new Set(userWords.map((w) => w.category).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  const select = elements.wordCategory;
  const current = select.value;
  select.innerHTML = `
    <option value="">Выберите категорию</option>
    ${categories.map((c) => `<option value="${c}">${c}</option>`).join("")}
    <option value="new">+ Создать новую</option>
  `;
  select.value = current || "";
}

/* ---------- Excel импорт ---------- */
async function handleExcelUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    showNotification("Файл не выбран", "error");
    return;
  }
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: ["english", "russian", "category"],
        defval: "",
      });

      if (!rows.length) {
        showNotification("Файл пуст или неверный формат", "error");
        return;
      }

      let added = 0;
      for (const row of rows) {
        const english = String(row.english || "").trim();
        const russian = String(row.russian || "").trim();
        const category = String(row.category || "uncategorized").trim();
        if (!english || !russian) continue;

        const payload = {
          english,
          russian,
          category,
          example: "",
          exampleSentence: "",
          exampleTranslation: "",
          learned: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          reviewInterval: 1,
          easeFactor: 2.5,
          repetitions: 0,
          lastReviewed: null,
        };

        try {
          const ref = await db.collection("words").add(payload);
          userWords.push({
            id: ref.id,
            ...payload,
            createdAt: { seconds: Date.now() / 1000 },
          });
          added++;
        } catch (err) {
          console.error(`Error adding "${english}":`, err);
        }
      }

      updateCategoryDropdown();
      renderWordsList(userWords);
      showNotification(`Успешно добавлено ${added} слов`);
    };
    reader.onerror = () => showNotification("Ошибка чтения файла", "error");
    reader.readAsArrayBuffer(file);
  } catch (e) {
    console.error("Excel import error:", e);
    showNotification("Ошибка обработки Excel", "error");
  } finally {
    elements.excelUpload.value = "";
  }
}
/* ===========================
   WordMaster / script.js
   Полная версия (часть 3/3)
   =========================== */

/* ---------- Study (обучение) ---------- */
function getAvailableWords(reviewAny = false) {
  const today = isoToday();
  if (reviewAny) return userWords;

  return userWords.filter((word) => {
    if (word.learned) return false;
    if (!word.lastReviewed) return true;
    const last = new Date(word.lastReviewed);
    const next = new Date(last);
    next.setDate(last.getDate() + (word.reviewInterval || 1));
    return next.toISOString().split("T")[0] <= today;
  });
}

function startStudySession(reviewAny = false) {
  currentStudyWords = getAvailableWords(reviewAny).filter((w) => !w.learned);
  if (currentStudyWords.length === 0) {
    elements.studyInfo.textContent =
      userWords.length === 0
        ? "Добавьте слова для изучения!"
        : 'Все слова изучены! Нажмите "Повторить любые слова".';
    showNotification("Нет слов для изучения", "error");
    return;
  }
  currentStudyIndex = 0;
  elements.studyContainer.classList.add("active");

  document.getElementById("start-study").style.display = "none";
  document.getElementById("repeat-any").style.display = "none";
  document.getElementById("reset-study").style.display = "none";

  showNextStudyWord();
}

function showNextStudyWord() {
  if (currentStudyIndex >= currentStudyWords.length) {
    finishStudySession();
    return;
  }
  const w = currentStudyWords[currentStudyIndex];

  elements.studyWord.textContent = w.english;
  elements.studyTranslation.textContent = "";
  elements.studyExample.textContent = "";
  elements.studyExampleTranslation.textContent = "";

  elements.studyTranslation.classList.remove("show");
  elements.studyExample.classList.remove("show");
  elements.studyExampleTranslation.classList.remove("show");

  updateStudyProgress();
}

function showTranslation() {
  const w = currentStudyWords[currentStudyIndex];
  if (!w) {
    showNotification("Слово не найдено", "error");
    return;
  }
  elements.studyTranslation.textContent = w.russian;
  elements.studyTranslation.classList.add("show");
}

async function showExample() {
  const w = currentStudyWords[currentStudyIndex];
  if (!w) {
    showNotification("Слово не найдено", "error");
    return;
  }
  if (w.exampleSentence) {
    elements.studyExample.textContent = w.exampleSentence;
    elements.studyExample.classList.add("show");
    return;
  }
  if (w.example) {
    elements.studyExample.textContent = w.example;
    elements.studyExample.classList.add("show");
    return;
  }

  try {
    const ex = await generateExampleSentence(w.english);
    w.exampleSentence = ex;
    elements.studyExample.textContent = ex;
    elements.studyExample.classList.add("show");
    await db.collection("words").doc(w.id).update({ exampleSentence: ex });
  } catch (e) {
    console.error("Example generation error:", e);
    elements.studyExample.textContent = "Не удалось сгенерировать пример";
    showNotification("Ошибка генерации примера", "error");
  }
}

async function showExampleTranslation() {
  const w = currentStudyWords[currentStudyIndex];
  if (!w) {
    showNotification("Слово не найдено", "error");
    return;
  }
  const sentence = w.exampleSentence || w.example;
  if (!sentence) {
    showNotification("Нет примера для перевода", "error");
    return;
  }
  if (w.exampleTranslation) {
    elements.studyExampleTranslation.textContent = w.exampleTranslation;
    elements.studyExampleTranslation.classList.add("show");
    return;
  }

  try {
    const translated = await translateExampleSentence(sentence);
    w.exampleTranslation = translated;
    elements.studyExampleTranslation.textContent = translated;
    elements.studyExampleTranslation.classList.add("show");
    await db
      .collection("words")
      .doc(w.id)
      .update({ exampleTranslation: translated });
  } catch (e) {
    console.error("Translation error:", e);
    elements.studyExampleTranslation.textContent =
      "Не удалось перевести пример";
    showNotification("Ошибка перевода", "error");
  }
}

function pronounceExample() {
  const w = currentStudyWords[currentStudyIndex];
  const sentence = w?.exampleSentence || w?.example;
  if (!sentence) {
    showNotification("Нет примера для произношения", "error");
    return;
  }
  try {
    const u = new SpeechSynthesisUtterance(sentence);
    u.lang = "en-US";
    u.volume = 1.0;
    speechSynthesis.speak(u);
  } catch (e) {
    console.error("Pronounce example error:", e);
    showNotification("Ошибка произношения примера", "error");
  }
}

async function handleStudyResponse(knowsWord) {
  const w = currentStudyWords[currentStudyIndex];
  if (!w) return;

  const today = isoToday();

  try {
    if (knowsWord) {
      await markWordAsLearned(w.id);
      await addXP(5);
      showNotification("Отлично! +5 опыта");
    } else {
      showNotification("Попробуйте ещё", "error");
    }

    // SM-2-like адаптация
    let { reviewInterval, easeFactor, repetitions } = w;
    repetitions = (repetitions || 0) + 1;
    if (knowsWord) {
      easeFactor = (easeFactor || 2.5) + 0.1;
      reviewInterval = Math.max(
        1,
        Math.round((reviewInterval || 1) * easeFactor)
      );
    } else {
      easeFactor = Math.max(1.3, (easeFactor || 2.5) - 0.3);
      reviewInterval = 1;
    }

    await db
      .collection("words")
      .doc(w.id)
      .update({
        reviewInterval,
        easeFactor,
        repetitions,
        lastReviewed: today,
        learned: knowsWord || w.learned || false,
      });

    // локально
    w.reviewInterval = reviewInterval;
    w.easeFactor = easeFactor;
    w.repetitions = repetitions;
    w.lastReviewed = today;
    if (knowsWord) w.learned = true;

    currentStudyIndex++;
    showNextStudyWord();
  } catch (e) {
    console.error("Study response error:", e);
    showNotification("Ошибка при обновлении слова", "error");
  }
}

function updateStudyProgress() {
  const total = currentStudyWords.length;
  const done = currentStudyIndex;
  const pct = total ? Math.round((done / total) * 100) : 0;

  elements.studyProgressText.textContent = `${done}/${total} слов`;
  elements.studyProgressBar.style.width = `${pct}%`;
}

function finishStudySession() {
  elements.studyContainer.classList.remove("active");
  document.getElementById("start-study").style.display = "block";
  document.getElementById("repeat-any").style.display = "block";
  document.getElementById("reset-study").style.display = "block";

  elements.studyInfo.textContent = "Сессия завершена!";
  showNotification("Отличная работа! Сессия завершена.");
  updateStreak();
}

async function updateStreak() {
  const today = isoToday();
  if (userProgress.lastStudyDate === today) return;

  const last = userProgress.lastStudyDate
    ? new Date(userProgress.lastStudyDate)
    : null;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const isConsecutive =
    last &&
    last.toISOString().split("T")[0] === yesterday.toISOString().split("T")[0];

  userProgress.streak = isConsecutive ? (userProgress.streak || 0) + 1 : 1;
  userProgress.lastStudyDate = today;

  await db.collection("userProgress").doc("user1").set(
    {
      streak: userProgress.streak,
      lastStudyDate: today,
    },
    { merge: true }
  );

  updateProgressUI();
}

async function resetStudyProgress() {
  if (!confirm("Сбросить весь прогресс?")) return;
  try {
    const batch = db.batch();

    userWords.forEach((w) => {
      const ref = db.collection("words").doc(w.id);
      batch.update(ref, {
        learned: false,
        reviewInterval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        lastReviewed: null,
      });
    });

    const progressRef = db.collection("userProgress").doc("user1");
    batch.set(progressRef, {
      streak: 0,
      totalWordsLearned: 0,
      xp: 0,
      lastStudyDate: null,
    });

    await batch.commit();

    // локально
    userWords = userWords.map((w) => ({
      ...w,
      learned: false,
      reviewInterval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      lastReviewed: null,
    }));

    userProgress = {
      streak: 0,
      totalWordsLearned: 0,
      xp: 0,
      lastStudyDate: null,
    };

    updateProgressUI();
    renderWordsList(userWords);
    showNotification("Прогресс сброшен");
  } catch (e) {
    console.error("Reset progress error:", e);
    showNotification("Ошибка при сбросе", "error");
  }
}

/* ---------- Произношение ---------- */
let availableVoices = [];
window.speechSynthesis.onvoiceschanged = () => {
    availableVoices = speechSynthesis.getVoices();
    console.log("Голоса загружены:", availableVoices);
};

function pronounceWord(word) {
    console.log("Попытка произнести слово:", word);
    if (!window.speechSynthesis) {
        showNotification("Произношение не поддерживается браузером. Попробуйте другой браузер.", "error");
        console.error("SpeechSynthesis API отсутствует. Браузер:", navigator.userAgent);
        return;
    }
    if (!word || typeof word !== "string" || word.trim() === "") {
        showNotification("Слово пустое или некорректное", "error");
        console.error("Некорректное слово:", word);
        return;
    }
    
    const tryPronounce = () => {
        const voices = availableVoices;
        console.log("Доступные голоса:", voices);
        const enVoice = voices.find(v => v.lang.startsWith("en")) || voices[0];
        if (!enVoice) {
            showNotification(
                "Голос не найден. Установите голосовой пакет для английского языка в настройках устройства.",
                "error"
            );
            console.error("Голос не найден, доступные голоса:", voices);
            return;
        }
        try {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = enVoice.lang.startsWith("en") ? "en-US" : enVoice.lang;
            utterance.volume = 1.0;
            utterance.rate = 0.9; // Добавлено из предложенного кода
            utterance.pitch = 1;   // Добавлено из предложенного кода
            utterance.voice = enVoice;
            console.log("Utterance объект:", utterance);
            speechSynthesis.speak(utterance);
            console.log("Произношение инициировано для:", word);
        } catch (e) {
            console.error("Pronounce word error:", e);
            showNotification("Ошибка произношения: " + e.message, "error");
        }
    };

    if (availableVoices.length === 0) {
        console.log("Ожидание загрузки голосов...");
        window.speechSynthesis.onvoiceschanged = () => {
            availableVoices = speechSynthesis.getVoices();
            console.log("Голоса загружены:", availableVoices);
            tryPronounce();
        };
    } else {
        tryPronounce();
    }
}

function pronounceExample() {
    const w = currentStudyWords[currentStudyIndex];
    const sentence = w?.exampleSentence || w?.example;
    console.log("Попытка произнести пример:", sentence);
    if (!window.speechSynthesis) {
        showNotification("Произношение не поддерживается браузером. Попробуйте другой браузер.", "error");
        console.error("SpeechSynthesis API отсутствует. Браузер:", navigator.userAgent);
        return;
    }
    if (!sentence || typeof sentence !== "string" || sentence.trim() === "") {
        showNotification("Пример пустой или некорректный", "error");
        console.error("Некорректный пример:", sentence);
        return;
    }
    
    const tryPronounce = () => {
        const voices = availableVoices;
        console.log("Доступные голоса:", voices);
        const enVoice = voices.find(v => v.lang.startsWith("en")) || voices[0];
        if (!enVoice) {
            showNotification(
                "Голос не найден. Установите голосовой пакет для английского языка в настройках устройства.",
                "error"
            );
            console.error("Голос не найден, доступные голоса:", voices);
            return;
        }
        try {
            const utterance = new SpeechSynthesisUtterance(sentence);
            utterance.lang = enVoice.lang.startsWith("en") ? "en-US" : enVoice.lang;
            utterance.volume = 1.0;
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.voice = enVoice;
            console.log("Utterance объект:", utterance);
            speechSynthesis.speak(utterance);
            console.log("Произношение инициировано для:", sentence);
        } catch (e) {
            console.error("Pronounce example error:", e);
            showNotification("Ошибка произношения примера: " + e.message, "error");
        }
    };

    if (availableVoices.length === 0) {
        console.log("Ожидание загрузки голосов...");
        window.speechSynthesis.onvoiceschanged = () => {
            availableVoices = speechSynthesis.getVoices();
            console.log("Голоса загружены:", availableVoices);
            tryPronounce();
        };
    } else {
        tryPronounce();
    }
}

/* ---------- Quiz (викторина) ---------- */
function buildQuizOptions(targetWord) {
  const wrong = shuffle(
    userWords.filter(
      (w) => w.id !== targetWord.id && w.russian !== targetWord.russian
    )
  )
    .slice(0, 3)
    .map((w) => w.russian);

  return shuffle([targetWord.russian, ...wrong]);
}

function initQuiz(reviewAny = false) {
  const pool = getAvailableWords(reviewAny);
  if (pool.length === 0) {
    showNotification("Нет слов для викторины", "error");
    elements.quizWord.textContent = "";
    elements.quizOptions.innerHTML = "";
    return;
  }

  currentQuizWord = randOf(pool);
  const options = buildQuizOptions(currentQuizWord);

  elements.quizWord.textContent = currentQuizWord.english;
  elements.quizOptions.innerHTML = "";
  selectedQuizOption = null;

  options.forEach((text) => {
    const el = document.createElement("div");
    el.className = "quiz-option";
    el.textContent = text;
    elements.quizOptions.appendChild(el);
  });
}

function pronounceQuizWord() {
  if (!currentQuizWord) return;
  pronounceWord(currentQuizWord.english);
}

async function checkQuizAnswer() {
  if (!selectedQuizOption || !currentQuizWord) {
    showNotification("Выберите вариант ответа", "error");
    return;
  }

  const isCorrect = selectedQuizOption.textContent === currentQuizWord.russian;
  const today = isoToday();

  try {
    let { reviewInterval, easeFactor, repetitions } = currentQuizWord;
    repetitions = (repetitions || 0) + 1;

    if (isCorrect) {
      selectedQuizOption.classList.add("correct");
      easeFactor = (easeFactor || 2.5) + 0.1;
      reviewInterval = Math.round((reviewInterval || 1) * easeFactor);

      await markWordAsLearned(currentQuizWord.id);
      await addXP(10);
      showNotification("Правильно! +10 опыта");

      await db.collection("words").doc(currentQuizWord.id).update({
        reviewInterval,
        easeFactor,
        repetitions,
        lastReviewed: today,
      });
    } else {
      selectedQuizOption.classList.add("incorrect");
      elements.quizOptions.querySelectorAll(".quiz-option").forEach((el) => {
        if (el.textContent === currentQuizWord.russian)
          el.classList.add("correct");
      });

      easeFactor = Math.max(1.3, (easeFactor || 2.5) - 0.3);
      reviewInterval = 1;

      showNotification("Неправильно! Попробуйте ещё раз.", "error");

      await db.collection("words").doc(currentQuizWord.id).update({
        reviewInterval,
        easeFactor,
        repetitions,
        lastReviewed: today,
      });
    }

    // обновим локально
    currentQuizWord.reviewInterval = reviewInterval;
    currentQuizWord.easeFactor = easeFactor;
    currentQuizWord.repetitions = repetitions;
    currentQuizWord.lastReviewed = today;

    setTimeout(() => initQuiz(false), 1200);
  } catch (e) {
    console.error("Quiz update error:", e);
    showNotification("Ошибка викторины", "error");
  }
}

/* ---------- Tasks (задания) ---------- */
async function generateTask() {
  const taskType = document.getElementById("task-type").value;
  const pool = getAvailableWords(true);
  const available = pool.slice(0, 10); // чуть шире выборка

  if (available.length < 3) {
    elements.taskText.textContent = "Добавьте минимум 3 слова для заданий!";
    showNotification("Недостаточно слов для задания", "error");
    return;
  }

  const wordsList = shuffle(available)
    .slice(0, 5)
    .map((w) => w.english)
    .join(", ");
  elements.taskText.textContent = "Генерируем задание...";
  elements.taskInput.value = "";
  elements.taskInfo.textContent = "";

  try {
    const text = await aiGenerateTask(taskType, wordsList);
    currentTask = { type: taskType, text };
    elements.taskText.textContent = text;
    elements.taskInfo.textContent = "Введите перевод на русский язык:";
  } catch (e) {
    console.error("Task generate error:", e);
    elements.taskText.textContent = "Не удалось сгенерировать задание.";
    showNotification("Ошибка генерации задания", "error");
  }
}

async function checkTaskAnswer() {
  if (!currentTask || !elements.taskInput.value.trim()) {
    showNotification("Введите ответ", "error");
    return;
  }
  try {
    const feedback = await aiCheckTask(
      currentTask.text,
      elements.taskInput.value.trim()
    );
    elements.taskInfo.textContent = feedback;
    showNotification("Ответ проверен");
  } catch (e) {
    console.error("Check task error:", e);
    showNotification("Ошибка проверки задания", "error");
  }
}

/* ---------- AI-хелперы (OpenRouter с фолбэками) ---------- */
async function callOpenRouterChat(
  messages,
  { max_tokens = 100, temperature = 0.7 } = {}
) {
  // безопасный выход, если нет ключа
  if (
    !OPENROUTER_API_KEY ||
    OPENROUTER_API_KEY.includes("PUT_YOUR_OPENROUTER_KEY_HERE")
  ) {
    throw new Error("NO_KEY");
  }
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",
      messages,
      max_tokens,
      temperature,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`OpenRouter API error: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Invalid API response structure");
  return content;
}

async function generateExampleSentence(word) {
  try {
    const content = await callOpenRouterChat(
      [
        {
          role: "system",
          content:
            "You generate simple example sentences (<= 8 words) for beginners.",
        },
        {
          role: "user",
          content: `Create one simple English sentence (max 8 words) using the word "${word}".`,
        },
      ],
      { max_tokens: 30, temperature: 0.6 }
    );
    // иногда модель добавляет кавычки/разметку
    return content.replace(/^["'`]+|["'`]+$/g, "");
  } catch (e) {
    // фолбэк без сети/ключа
    return `I use ${word} every day.`;
  }
}

async function translateExampleSentence(sentence) {
  try {
    const content = await callOpenRouterChat(
      [
        { role: "system", content: "You translate simple English to Russian." },
        { role: "user", content: `Translate to Russian: "${sentence}"` },
      ],
      { max_tokens: 60, temperature: 0.2 }
    );
    return content.replace(/^["'`]+|["'`]+$/g, "");
  } catch (e) {
    // фолбэк
    return "Перевод недоступен.";
  }
}

async function aiGenerateTask(taskType, wordsList) {
  const system =
    taskType === "dialogue"
      ? "Generate a short dialogue (3-4 exchanges, total 20-30 words) for beginners."
      : "Generate a short story (50-70 words) for beginners.";
  const prompt = `${system} Use at least 3 of these words: ${wordsList}. Provide Russian translation after the English text.`;

  try {
    const content = await callOpenRouterChat(
      [{ role: "system", content: prompt }],
      {
        max_tokens: 220,
        temperature: 0.7,
      }
    );
    return content;
  } catch {
    // фолбэк заготовка
    if (taskType === "dialogue") {
      return `A: Hello! Do you use these words? 
B: Yes, I use them daily.
A: Great, let's practice together.
B: Sure! (Перевод: Привет! Ты используешь эти слова? Да, я использую их ежедневно. Отлично, давай практиковаться вместе. Конечно!)`;
    }
    return `I wake up early and make coffee. I check my bag and go to work. At lunch, I read a short story. In the evening, I study new words. (Перевод: Я рано просыпаюсь и делаю кофе. Я проверяю сумку и иду на работу. В обед я читаю короткий рассказ. Вечером я учу новые слова.)`;
  }
}

async function aiCheckTask(originalText, studentTranslation) {
  try {
    const content = await callOpenRouterChat(
      [
        {
          role: "system",
          content:
            "You are a language teacher. Evaluate student's Russian translation of the given English text. Be concise, friendly, and give 2-3 concrete corrections.",
        },
        {
          role: "user",
          content: `Original:\n${originalText}\n\nStudent translation (RU):\n${studentTranslation}\n\nEvaluate briefly in Russian. If correct, say that.`,
        },
      ],
      { max_tokens: 160, temperature: 0.4 }
    );
    return content;
  } catch (e) {
    return "Не удалось проверить автоматически. Сети или ключа нет. Оцени самостоятельно по смыслу и грамматике.";
  }
}
// Показать перевод примера
// document.getElementById("show-example-translation").addEventListener("click", () => {
//   const translationEl = document.getElementById("study-example-translation");

//   if (translationEl.textContent.trim() === "") {
//     translationEl.textContent = "Перевод примера пока недоступен.";
//   }

//   // 👇 ключевой момент
//   translationEl.classList.add("show");
// });

elements.addWordBtn.addEventListener("click", addWord);

async function addWord() {
  const eng = elements.englishWord.value.trim().toLowerCase();
  const rus = elements.russianWord.value.trim().toLowerCase();

  if (!eng || !rus) {
    showNotification("Заполните оба поля!", "error");
    return;
  }

  // Проверка дубля (по userWords)
  const exists = userWords.some((w) => (w.english || "").toLowerCase() === eng);

  if (exists) {
    showNotification("Такое слово уже есть!", "error");
    return;
  }

  // Добавляем в Firestore
  try {
    const ref = await db.collection("words").add({
      english: eng,
      russian: rus,
      learned: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      englishLower: eng, // для будущих проверок
      russianLower: rus,
    });

    userWords.push({ id: ref.id, english: eng, russian: rus, learned: false });
    showNotification("Слово добавлено!");
  } catch (e) {
    console.error("Ошибка при добавлении:", e);
    showNotification("Ошибка при добавлении!", "error");
  }

  // очистка формы
  elements.englishWord.value = "";
  elements.russianWord.value = "";
}

