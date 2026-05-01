const q = (s) => document.querySelector(s);
const listEl = q('#quiz-list');
const panelContent = q('#panel-content');
const meta = q('#meta');
const countEl = q('#quiz-count');
const listError = q('#list-error');

let manifest = null;
let currentQuiz = null;
let currentIndex = 0;
let answers = new Map();
let currentFile = '';

function showPanelMessage(title, body, kind = 'note') {
  const cls = kind === 'error' ? 'state-error' : 'state-note';
  panelContent.innerHTML = '<div class="empty-state"><p class="' + cls + '"><strong>' + title + '</strong></p><p>' + body + '</p></div>';
}

function validateManifestShape(data) {
  if (!data || typeof data !== 'object') return 'Manifest invalide (objet attendu).';
  if (!Array.isArray(data.quizzes)) return 'Manifest invalide (quizzes doit être un tableau).';
  return null;
}

function validateQuizShape(data) {
  if (!data || typeof data !== 'object') return 'Quiz invalide (objet attendu).';
  if (!Array.isArray(data.questions)) return 'Quiz invalide (questions doit être un tableau).';
  return null;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' sur ' + url);
  return res.json();
}

function renderList() {
  listEl.innerHTML = '';
  listError.classList.add('hidden');
  countEl.textContent = String(manifest.quizzes.length);

  if (!manifest.quizzes.length) {
    showPanelMessage('Aucun quiz disponible', 'Génère des quiz avec la commande quizgen run <pdf>.');
    return;
  }

  for (const item of manifest.quizzes) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quiz-btn' + (item.file === currentFile ? ' active' : '');
    btn.setAttribute('aria-label', 'Ouvrir le quiz ' + item.title);
    btn.innerHTML = '<strong>' + item.title + '</strong><br><span class="state-note">' + item.questionCount + ' questions</span>';
    btn.addEventListener('click', () => loadQuiz(item.file));
    li.appendChild(btn);
    listEl.appendChild(li);
  }
}

function renderQuestion() {
  const question = currentQuiz.questions[currentIndex];
  if (!question) {
    showPanelMessage('Question introuvable', 'Le quiz semble incomplet.', 'error');
    return;
  }

  const selected = answers.get(question.id);
  const choices = question.choices.map((choice, idx) => {
    const classes = 'choice' + (selected === idx ? ' selected' : '');
    const disabled = selected !== undefined ? 'disabled' : '';
    return '<button class="' + classes + '" data-choice="' + idx + '" ' + disabled + '>' + choice + '</button>';
  }).join('');

  panelContent.innerHTML =
    '<p class="state-note">Question ' + (currentIndex + 1) + ' / ' + currentQuiz.questions.length + '</p>' +
    '<h3 class="question-title">' + question.prompt + '</h3>' +
    choices +
    '<div class="row">' +
      '<button class="nav" id="prev" ' + (currentIndex === 0 ? 'disabled' : '') + '>Précédent</button>' +
      '<button class="nav primary" id="next">' + (currentIndex === currentQuiz.questions.length - 1 ? 'Terminer' : 'Suivant') + '</button>' +
    '</div>';

  panelContent.querySelectorAll('[data-choice]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      const value = Number(evt.currentTarget.dataset.choice);
      answers.set(question.id, value);
      renderQuestion();
    });
  });

  q('#prev').addEventListener('click', () => {
    currentIndex -= 1;
    renderQuestion();
  });

  q('#next').addEventListener('click', () => {
    if (currentIndex === currentQuiz.questions.length - 1) {
      renderResult();
      return;
    }
    currentIndex += 1;
    renderQuestion();
  });
}

function renderResult() {
  let score = 0;
  const rows = currentQuiz.questions.map((question) => {
    const got = answers.get(question.id);
    const ok = got === question.correctIndex;
    if (ok) score += 1;
    const your = got !== undefined ? question.choices[got] : 'Aucune réponse';
    const good = question.choices[question.correctIndex] ?? 'N/A';
    const status = ok ? '<span class="state-ok">OK</span>' : '<span class="state-error">Erreur</span>';
    return '<li><strong>' + question.prompt + '</strong><br>Ta réponse: ' + your + '<br>Correction: ' + good + ' ' + status + '</li>';
  }).join('');

  panelContent.innerHTML =
    '<h3>Résultat final</h3>' +
    '<p class="state-ok">Score: ' + score + ' / ' + currentQuiz.questions.length + '</p>' +
    '<ol>' + rows + '</ol>' +
    '<div class="row">' +
      '<button class="nav primary" id="restart">Recommencer</button>' +
    '</div>';

  q('#restart').addEventListener('click', () => {
    answers = new Map();
    currentIndex = 0;
    renderQuestion();
  });
}

async function loadQuiz(file) {
  currentFile = file;
  renderList();
  showPanelMessage('Chargement du quiz…', 'Récupération des questions en cours.');

  try {
    const data = await fetchJson('./data/' + file);
    const shapeErr = validateQuizShape(data);
    if (shapeErr) {
      showPanelMessage('Quiz invalide', shapeErr, 'error');
      return;
    }
    currentQuiz = data;
    answers = new Map();
    currentIndex = 0;
    renderQuestion();
  } catch (err) {
    showPanelMessage('Erreur de chargement', 'Impossible de charger ' + file + '. Vérifie la présence du fichier JSON.', 'error');
  }
}

async function bootstrap() {
  meta.textContent = 'Lecture du manifest…';
  try {
    const data = await fetchJson('./data/manifest.json');
    const shapeErr = validateManifestShape(data);
    if (shapeErr) {
      meta.textContent = 'Manifest invalide';
      listError.textContent = shapeErr;
      listError.classList.remove('hidden');
      showPanelMessage('Manifest invalide', shapeErr, 'error');
      return;
    }
    manifest = data;
    const title = manifest.documentTitle || 'Quiz Zone';
    meta.textContent = title + ' · ' + manifest.quizzes.length + ' quiz';
    renderList();
  } catch (err) {
    meta.textContent = 'Manifest non disponible';
    const msg = 'Impossible de lire data/manifest.json. Lance quizgen scaffold puis quizgen run <pdf>.';
    listError.textContent = msg;
    listError.classList.remove('hidden');
    showPanelMessage('Données manquantes', msg, 'error');
  }
}

bootstrap();
