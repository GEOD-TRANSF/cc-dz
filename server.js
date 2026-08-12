const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Routes pour les pages HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'moderateur.html')));
app.get('/editeur', (req, res) => res.sendFile(path.join(__dirname, 'editeur.html')));

// Gestion du fichier JSON pour les questions
const QUESTIONS_FILE = path.join(__dirname, 'questions.json');

function lireQuestions() {
  if (!fs.existsSync(QUESTIONS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function ecrireQuestions(questions) {
  fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2));
}

// --- API REST POUR L'ÉDITEUR ---

// Obtenir toutes les questions
app.get('/api/questions', (req, res) => res.json(lireQuestions()));

// Ajouter une question
app.post('/api/questions', (req, res) => {
  const questions = lireQuestions();
  const nouvelleQ = { id: Date.now(), ...req.body };
  questions.push(nouvelleQ);
  ecrireQuestions(questions);
  res.json({ success: true });
});

// Supprimer une question
app.delete('/api/questions/:id', (req, res) => {
  const idParam = parseInt(req.params.id);
  let questions = lireQuestions();
  questions = questions.filter(q => q.id !== idParam);
  ecrireQuestions(questions);
  res.json({ success: true });
});

// Modifier une question
app.put('/api/questions/:id', (req, res) => {
  const idParam = parseInt(req.params.id);
  let questions = lireQuestions();
  const index = questions.findIndex(q => q.id === idParam);
  
  if (index !== -1) {
    questions[index] = { id: idParam, ...req.body };
    ecrireQuestions(questions);
    return res.json({ success: true });
  }
  res.status(404).json({ error: "Question non trouvée" });
});

// --- ÉTAT GLOBAL DU JEU ET SOCKET.IO ---

let gameState = {
  roomCode: "111111",
  joueurs: {},
  questionIndex: -1,
  tempsRestant: 0,
  timerInterval: null
};

function demarrerQuestion(index) {
  const questions = lireQuestions();
  
  if (index >= questions.length) {
    clearInterval(gameState.timerInterval);
    const classement = Object.values(gameState.joueurs).sort((a, b) => b.score - a.score);
    io.emit('finDePartie', classement);
    return;
  }

  gameState.questionIndex = index;
  const q = questions[index];
  gameState.tempsRestant = q.tempsLimiteSec;

  io.emit('nouvelleQuestion', {
    id: index + 1,
    totalQuestions: questions.length,
    question: q.question,
    propositions: q.propositions,
    tempsLimiteSec: q.tempsLimiteSec
  });

  clearInterval(gameState.timerInterval);
  gameState.timerInterval = setInterval(() => {
    gameState.tempsRestant--;
    io.emit('tickTimer', gameState.tempsRestant);

    if (gameState.tempsRestant <= 0) {
      clearInterval(gameState.timerInterval);
      io.emit('tempsEcoule');
    }
  }, 1000);
}

io.on('connection', (socket) => {
  // Connexion d'un joueur
  socket.on('joinRoom', ({ pseudo, code }) => {
    if (code !== gameState.roomCode) {
      return socket.emit('erreur', 'Code du salon incorrect !');
    }

    gameState.joueurs[socket.id] = { id: socket.id, pseudo, score: 0, bloque: false };
    socket.emit('joinedSuccess', { pseudo });
    io.emit('updateJoueursList', Object.values(gameState.joueurs));
  });

  // Lancement de la question suivante par le modérateur
  socket.on('nextQuestion', () => {
    demarrerQuestion(gameState.questionIndex + 1);
  });

  // Réinitialisation de la partie par le modérateur
  socket.on('restartQuiz', () => {
    clearInterval(gameState.timerInterval);
    gameState.questionIndex = -1;
    gameState.tempsRestant = 0;

    // Remettre les scores à zéro pour tous les joueurs actuellement connectés
    Object.keys(gameState.joueurs).forEach(id => {
      gameState.joueurs[id].score = 0;
    });

    // Mettre à jour l'affichage de la liste des joueurs
    io.emit('updateJoueursList', Object.values(gameState.joueurs));
    io.emit('quizReset');
  });

  // Soumission d'une réponse par un joueur
  socket.on('submitReponse', ({ reponseIndex }) => {
    const questions = lireQuestions();
    const q = questions[gameState.questionIndex];
    const joueur = gameState.joueurs[socket.id];

    if (!joueur || joueur.bloque || !q) return;

    if (reponseIndex === q.reponseCorrecte) {
      const points = Math.round(1000 * (gameState.tempsRestant / q.tempsLimiteSec));
      joueur.score += Math.max(points, 100);
      socket.emit('reponseResultat', { correct: true, points });
    } else {
      socket.emit('reponseResultat', { correct: false, points: 0 });
    }

    io.emit('updateJoueursList', Object.values(gameState.joueurs));
  });

  // Gestion des émojis
  socket.on('sendEmoji', (emoji) => {
    const joueur = gameState.joueurs[socket.id];
    if (joueur && !joueur.bloque) {
      io.emit('newEmoji', { emoji });
    }
  });

  // Blocage / Exclusion d'un joueur
  socket.on('blockPlayer', (socketId) => {
    if (gameState.joueurs[socketId]) {
      gameState.joueurs[socketId].bloque = true;
      io.to(socketId).emit('bloque', 'Vous avez été exclu du salon par le modérateur.');
      delete gameState.joueurs[socketId];
      io.emit('updateJoueursList', Object.values(gameState.joueurs));
    }
  });

  // Déconnexion d'un joueur
  socket.on('disconnect', () => {
    delete gameState.joueurs[socket.id];
    io.emit('updateJoueursList', Object.values(gameState.joueurs));
  });
});

// Port dynamique pour le déploiement local ou cloud
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`--- CAFÉ DE LA CULTURE SERVEUR DÉMARRÉ SUR LE PORT ${PORT} ---`);
});