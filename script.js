// Connexion au serveur WebSocket
const socket = io();
let totalScore = 0;

// 1. Inscription à la partie
function rejoindrePartie() {
  const pseudo = document.getElementById('pseudoInput').value.trim();
  const code = document.getElementById('codeInput').value.trim();

  if (!pseudo || !code) {
    alert("Veuillez entrer un pseudo et un code !");
    return;
  }

  socket.emit('joinRoom', { pseudo, code });
}

// Validation de connexion
socket.on('joinedSuccess', (data) => {
  document.getElementById('loginBlock').classList.add('hidden');
  document.getElementById('gameBlock').classList.remove('hidden');
  document.getElementById('emojiBar').classList.remove('hidden');
});

socket.on('erreur', (message) => {
  alert(message);
});

// 2. Affichage des nouvelles questions
socket.on('nouvelleQuestion', (q) => {
  document.getElementById('questionNum').innerText = `Question ${q.id}`;
  document.getElementById('questionText').innerText = q.question;
  document.getElementById('opt0').innerText = q.propositions[0] || '---';
  document.getElementById('opt1').innerText = q.propositions[1] || '---';
  document.getElementById('opt2').innerText = q.propositions[2] || '---';
  document.getElementById('opt3').innerText = q.propositions[3] || '---';
});

// 3. Envoi de la réponse du joueur
function envoyerReponse(indexReponse) {
  socket.emit('submitReponse', { reponseIndex: indexReponse });
}

socket.on('reponseResultat', (res) => {
  if (res.correct) {
    totalScore += res.points;
    const scoreEl = document.getElementById('userScore');
    if (scoreEl) scoreEl.innerText = `${totalScore} pts`;
  }
});

// 4. Réinitialisation du quiz (quand le modérateur recommence une partie)
socket.on('quizReset', () => {
  totalScore = 0;
  const scoreEl = document.getElementById('userScore');
  if (scoreEl) scoreEl.innerText = `0 pts`;
  
  document.getElementById('questionNum').innerText = "En attente...";
  document.getElementById('questionText').innerText = "Le modérateur va relancer la partie !";
});

// 5. Gestion des exclusions (Modération)
socket.on('bloque', (message) => {
  alert(message);
  window.location.reload();
});

// 6. Envoi et affichage des émojis volants
function envoyerEmoji(emoji) {
  socket.emit('sendEmoji', emoji);
}

socket.on('newEmoji', ({ emoji }) => {
  const el = document.createElement('div');
  el.innerText = emoji;
  el.className = 'emoji-volant';
  
  el.style.left = Math.random() * 80 + 10 + '%';
  el.style.bottom = '80px';
  
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
});