// scaffold-managed:minimal-modern
const q = (s) => document.querySelector(s);
const listEl = q('#quiz-list');
const panelContent = q('#panel-content');
const countEl = q('#quiz-count');
const listError = q('#list-error');

let manifest = null;
let currentQuiz = null;
let currentIndex = 0;
let answers = new Map();
let currentFile = '';

function showPanelMessage(title, body, kind = 'note') {
  const cls = kind === 'error' ? 'state-error' : 'state-note';
  panelContent.innerHTML = '<div class="empty-state"><div class="empty-icon">' + (kind === 'error' ? '⚠️' : '📚') + '</div><p class="empty-title ' + cls + '">' + title + '</p><p class="empty-sub">' + body + '</p></div>';
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
    showPanelMessage('Aucun quiz disponible', 'Génère des quiz avec la commande quizgen run &lt;pdf&gt;.');
    return;
  }

  // Group quizzes by course
  const groups = new Map();
  for (const item of manifest.quizzes) {
    const course = item.course || 'Général';
    const normalized = course.charAt(0).toUpperCase() + course.slice(1).toLowerCase();
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized).push(item);
  }

  // Sort course names, putting 'Général' first
  const sortedCourses = Array.from(groups.keys()).sort((a, b) => {
    if (a === 'Général') return -1;
    if (b === 'Général') return 1;
    return a.localeCompare(b);
  });

  for (const course of sortedCourses) {
    const items = groups.get(course);
    
    const details = document.createElement('details');
    details.className = 'course-group';
    details.open = true;
    
    const summary = document.createElement('summary');
    summary.className = 'course-header';
    summary.innerHTML = '<span>' + course + '</span>';
    details.appendChild(summary);

    const ul = document.createElement('ul');
    ul.className = 'course-items';

    for (const item of items) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-btn' + (item.file === currentFile ? ' active' : '');
      btn.innerHTML = '<strong>' + item.title + '</strong><span class="state-note">' + item.questionCount + ' questions</span>';
      btn.addEventListener('click', () => loadQuiz(item.file));
      li.appendChild(btn);
      ul.appendChild(li);
    }
    
    details.appendChild(ul);
    listEl.appendChild(details);
  }
}

function shuffleQuizChoices(quiz) {
  for (const q of quiz.questions) {
    const choicesWithOriginal = q.choices.map((text, idx) => ({
      text,
      isCorrect: idx === q.correctIndex,
      isAllFalse: text.toLowerCase().trim() === "toutes les réponses sont fausses" || 
                  text.toLowerCase().trim() === "aucune des réponses n'est correcte" ||
                  text.toLowerCase().trim() === "aucune de ces réponses"
    }));

    const normalChoices = [];
    const allFalseChoices = [];
    for (const c of choicesWithOriginal) {
      if (c.isAllFalse) allFalseChoices.push(c);
      else normalChoices.push(c);
    }

    for (let i = normalChoices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [normalChoices[i], normalChoices[j]] = [normalChoices[j], normalChoices[i]];
    }

    const newChoices = [...normalChoices, ...allFalseChoices];
    
    q.choices = newChoices.map(c => c.text);
    q.correctIndex = newChoices.findIndex(c => c.isCorrect);
  }
}

function renderQuestion() {
  const question = currentQuiz.questions[currentIndex];
  if (!question) {
    showPanelMessage('Question introuvable', 'Le quiz semble incomplet.', 'error');
    return;
  }

  const selected = answers.get(question.id);
  const isAnswered = selected !== undefined;
  
  const choices = question.choices.map((choice, idx) => {
    let classes = 'choice';
    if (isAnswered) {
      if (idx === question.correctIndex) classes += ' correct';
      else if (idx === selected) classes += ' incorrect';
    } else if (selected === idx) {
      classes += ' selected';
    }
    
    const disabled = isAnswered ? 'disabled' : '';
    const icon = isAnswered && idx === question.correctIndex ? ' ✓' : (isAnswered && idx === selected ? ' ✗' : '');
    
    return '<button class="' + classes + '" data-choice="' + idx + '" ' + disabled + '>' + choice + icon + '</button>';
  }).join('');

  panelContent.innerHTML =
    '<p class="state-note">Question ' + (currentIndex + 1) + ' / ' + currentQuiz.questions.length + '</p>' +
    '<h3 class="question-title">' + question.prompt + '</h3>' +
    '<div class="choices-container" role="radiogroup" aria-labelledby="question-title">' + choices + '</div>' +
    '<div class="row">' +
      '<button class="nav" id="prev" ' + (currentIndex === 0 ? 'disabled' : '') + '>Précédent</button>' +
      '<button class="nav primary" id="next" ' + (!isAnswered ? 'disabled' : '') + '>' + (currentIndex === currentQuiz.questions.length - 1 ? 'Terminer' : 'Suivant') + '</button>' +
    '</div>';

  panelContent.querySelectorAll('[data-choice]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      if (isAnswered) return;
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
    if (!answers.has(question.id)) return;
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
    const status = ok ? '<span class="state-ok">✓ Correct</span>' : '<span class="state-error">✗ Erreur</span>';
    return '<li><strong>' + question.prompt + '</strong><br><span class="state-note">Ta réponse: ' + your + '</span><br>Correction: ' + good + ' <br>' + status + '</li>';
  }).join('');

  panelContent.innerHTML =
    '<h3 class="question-title">Résultat final</h3>' +
    '<p class="state-ok" style="font-size: 1.5rem;">Score: ' + score + ' / ' + currentQuiz.questions.length + '</p>' +
    '<ol>' + rows + '</ol>' +
    '<div class="row">' +
      '<button class="nav primary" id="restart">Recommencer le quiz</button>' +
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
    shuffleQuizChoices(data);
    currentQuiz = data;
    answers = new Map();
    currentIndex = 0;
    renderQuestion();
  } catch (err) {
    showPanelMessage('Erreur de chargement', 'Impossible de charger ' + file + '. Vérifie la présence du fichier JSON.', 'error');
  }
}

async function bootstrap() {
  try {
    const data = await fetchJson('./data/manifest.json');
    const shapeErr = validateManifestShape(data);
    if (shapeErr) {
      listError.textContent = shapeErr;
      listError.classList.remove('hidden');
      showPanelMessage('Manifest invalide', shapeErr, 'error');
      return;
    }
    manifest = data;
    renderList();
  } catch (err) {
    const msg = 'Impossible de lire data/manifest.json. Lance quizgen scaffold puis quizgen run &lt;pdf&gt;.';
    listError.textContent = msg;
    listError.classList.remove('hidden');
    showPanelMessage('Données manquantes', msg, 'error');
  }
}

bootstrap();
