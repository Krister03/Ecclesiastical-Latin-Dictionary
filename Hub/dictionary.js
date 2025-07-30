const form = document.getElementById('dictionary-form');
const wordInput = document.getElementById('word');
const definitionInput = document.getElementById('definition');
const dictionaryList = document.getElementById('dictionary-list');
const sortBtn = document.getElementById('sort-btn');

let db;

// Open (or create) IndexedDB database
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LatinDictionaryDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => {
            const db = request.result;
            db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
        };
    });
}

// Migrate from localStorage to IndexedDB once
async function migrateIfNeeded() {
    const localData = localStorage.getItem('latinDictionary');
    if (localData) {
        const parsed = JSON.parse(localData);
        for (const item of parsed) {
            await addWord(item.word, item.definition);
        }
        localStorage.removeItem('latinDictionary');
    }
}

// Add a word to IndexedDB
function addWord(word, definition) {
    return new Promise((resolve) => {
        const tx = db.transaction('words', 'readwrite');
        const store = tx.objectStore('words');
        store.add({ word, definition });
        tx.oncomplete = resolve;
    });
}

// Get all words from IndexedDB
function getAllWords() {
    return new Promise((resolve) => {
        const tx = db.transaction('words', 'readonly');
        const store = tx.objectStore('words');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

// Delete word by ID
function deleteWord(id) {
    return new Promise((resolve) => {
        const tx = db.transaction('words', 'readwrite');
        const store = tx.objectStore('words');
        store.delete(Number(id));
        tx.oncomplete = resolve;
    });
}

// Render list
async function renderDictionary(sorted = false) {
    dictionaryList.innerHTML = '';
    let words = await getAllWords();
    if (sorted) {
        words.sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }));
    }
    words.forEach(({ id, word, definition }) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <strong>${word}:</strong> ${definition}
            <button class="edit-btn" data-id="${id}">Edit</button>
            <button class="delete-btn" data-id="${id}">Delete</button>
        `;
        dictionaryList.appendChild(listItem);
    });
}

// Handle form submit
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const word = wordInput.value.trim();
    const definition = definitionInput.value.trim();
    if (word && definition) {
        await addWord(word, definition);
        wordInput.value = '';
        definitionInput.value = '';
        renderDictionary();
    }
});

// Handle edit/delete buttons
dictionaryList.addEventListener('click', async (e) => {
    const id = e.target.getAttribute('data-id');
    if (!id) return;

    const words = await getAllWords();
    const wordObj = words.find(w => w.id == id);

    if (e.target.classList.contains('delete-btn')) {
        await deleteWord(id);
        renderDictionary();
    } else if (e.target.classList.contains('edit-btn')) {
        wordInput.value = wordObj.word;
        definitionInput.value = wordObj.definition;
        await deleteWord(id); // will re-add on submit
        renderDictionary();
    }
});

// Handle sorting
sortBtn.addEventListener('click', () => {
    renderDictionary(true);
});

// Export dictionary as JSON
async function exportDictionary() {
    const words = await getAllWords();
    const blob = new Blob([JSON.stringify(words, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'latin_dictionary.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Add export button event
document.getElementById('export-btn').addEventListener('click', exportDictionary);

// Import dictionary from JSON
async function importDictionary(event) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    let words;
    try {
        words = JSON.parse(text);
    } catch {
        alert('Invalid file format.');
        return;
    }
    for (const { word, definition } of words) {
        await addWord(word, definition);
    }
    renderDictionary();
}

// Add import button event
document.getElementById('import-input').addEventListener('change', importDictionary);

(async () => {
  db = await openDB();
  await migrateIfNeeded();
  const allWords = await getAllWords();
  console.log('IndexedDB words:', allWords);  // This logs your stored dictionary entries
  renderDictionary();
})();

