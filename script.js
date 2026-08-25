// Connexion au serveur WebSocket
const socket = io();
let totalScore = 0;
let aRepondu = false; // Bloque les clics multiples sur une même question

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
  aRepondu = false; // Réinitialise le verrou pour la nouvelle question

  // Réactive tous les boutons de réponse
  const boutons = document.querySelectorAll('#gameBlock button');
  boutons.forEach(btn => btn.disabled = false);

  document.getElementById('questionNum').innerText = `Question ${q.id}`;
  document.getElementById('questionText').innerText = q.question;
  document.getElementById('opt0').innerText = q.propositions[0] || '---';
  document.getElementById('opt1').innerText = q.propositions[1] || '---';
  document.getElementById('opt2').innerText = q.propositions[2] || '---';
  document.getElementById('opt3').innerText = q.propositions[3] || '---';
});

// 3. Envoi de la réponse du joueur
function envoyerReponse(indexReponse) {
  // Si le joueur a déjà cliqué, on ignore les autres clics ou le maintien de la touche
  if (aRepondu) return;
  
  aRepondu = true; // Active le verrouillage immédiatement

  // Désactive tous les boutons de réponse dans la page
  const boutons = document.querySelectorAll('#gameBlock button');
  boutons.forEach(btn => btn.disabled = true);

  socket.emit('submitReponse', { reponseIndex: indexReponse });
}

socket.on('reponseResultat', (res) => {
  if (res && res.correct) {
    totalScore += Number(res.points) || 0;
    const scoreEl = document.getElementById('userScore');
    if (scoreEl) scoreEl.innerText = `${totalScore} pts`;
  }
});

// 4. Réinitialisation du quiz (quand le modérateur recommence une partie)
socket.on('quizReset', () => {
  totalScore = 0;
  aRepondu = false;
  
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