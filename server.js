const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static('public'));

const games = {};

function roomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Колода из 36 карт (6..Туз, 4 масти)
function createDeck() {
  const suits = ['♠', '♣', '♥', '♦'];
  const values = ['6','7','8','9','10','J','Q','K','A'];
  const deck = [];
  for (const s of suits) {
    for (const v of values) {
      deck.push({ suit: s, value: v, trump: false });
    }
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

io.on('connection', (socket) => {
  socket.on('createRoom', (playerName) => {
    const id = roomId();
    const game = {
      id,
      players: [{ id: socket.id, name: playerName, hand: [] }],
      deck: createDeck(),
      trump: null,
      turn: 0,
      attack: null,
      defender: null,
      table: [],
      status: 'waiting',
    };
    // Определяем козырь (последняя карта)
    game.trump = game.deck[game.deck.length - 1].suit;
    // Каждая карта помечается козырем
    game.deck.forEach(c => c.trump = c.suit === game.trump);
    games[id] = game;
    socket.join(id);
    socket.emit('gameState', game);
  });

  socket.on('joinRoom', (room, playerName) => {
    const game = games[room];
    if (!game) return socket.emit('error', 'Комната не найдена');
    if (game.players.length >= 2) return socket.emit('error', 'Комната заполнена');
    game.players.push({ id: socket.id, name: playerName, hand: [] });
    socket.join(room);
    if (game.players.length === 2) {
      startGame(game, room);
    }
    io.to(room).emit('gameState', game);
  });

  socket.on('attack', (room, cardIndex) => {
    const game = games[room];
    if (!game || game.status !== 'playing') return;
    const player = game.players[game.turn];
    if (player.id !== socket.id) return;
    const card = player.hand[cardIndex];
    if (!card) return;
    // Убираем карту из руки
    player.hand.splice(cardIndex, 1);
    game.table.push({ attacker: card });
    game.attack = player.id;
    game.defender = game.players[1 - game.turn].id;
    io.to(room).emit('gameState', game);
  });

  socket.on('defend', (room, attackIndex, defendIndex) => {
    const game = games[room];
    if (!game || game.status !== 'playing') return;
    const player = game.players[1 - game.turn];
    if (player.id !== socket.id) return;
    const attackCard = game.table[attackIndex]?.attacker;
    const defendCard = player.hand[defendIndex];
    if (!attackCard || !defendCard) return;
    // Простая проверка: бьёт если старше и масть та же или козырь
    const beats = (defendCard.suit === attackCard.suit && defendCard.value >= attackCard.value) || (defendCard.trump && !attackCard.trump);
    if (beats) {
      player.hand.splice(defendIndex, 1);
      game.table[attackIndex].defender = defendCard;
      // Проверяем, все ли атаки отбиты
      if (game.table.every(t => t.defender)) {
        endTurn(game, room);
      }
    }
    io.to(room).emit('gameState', game);
  });

  socket.on('take', (room) => {
    const game = games[room];
    if (!game || game.status !== 'playing') return;
    const defender = game.players[1 - game.turn];
    if (defender.id !== socket.id) return;
    // Забирает все карты со стола
    game.table.forEach(t => {
      defender.hand.push(t.attacker);
      if (t.defender) defender.hand.push(t.defender);
    });
    game.table = [];
    // Добираем до 6 карт сначала атакующего, потом защищавшегося
    drawCards(game);
    nextRound(game, room);
    io.to(room).emit('gameState', game);
  });

  function startGame(game, room) {
    // Раздаём по 6 карт
    for (let i = 0; i < 6; i++) {
      game.players[0].hand.push(game.deck.pop());
      game.players[1].hand.push(game.deck.pop());
    }
    game.status = 'playing';
    // Определяем первого атакующего (у кого младший козырь или случайно)
    game.turn = 0;
  }

  function drawCards(game) {
    game.players.forEach(p => {
      while (p.hand.length < 6 && game.deck.length > 0) {
        p.hand.push(game.deck.pop());
      }
    });
  }

  function endTurn(game, room) {
    game.table = [];
    drawCards(game);
    // Меняем атакующего и защищающегося
    nextRound(game, room);
  }

  function nextRound(game, room) {
    game.turn = 1 - game.turn;
    game.attack = null;
    game.defender = null;
    io.to(room).emit('gameState', game);
  }

  socket.on('disconnect', () => {
    for (const id in games) {
      const g = games[id];
      const idx = g.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        g.players.splice(idx, 1);
        if (g.players.length === 0) delete games[id];
        else {
          g.status = 'waiting';
          io.to(id).emit('gameState', g);
        }
      }
    }
  });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
server.listen(3000, () => console.log('http://localhost:3000'));
