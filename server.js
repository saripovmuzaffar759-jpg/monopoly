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

const suits = ['♠', '♣', '♥', '♦'];
const values = ['6','7','8','9','10','J','Q','K','A'];
const valueOrder = Object.fromEntries(values.map((v, i) => [v, i + 6])); // 6..14

function createDeck() {
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value, trump: false, rank: valueOrder[value] });
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
    const deck = createDeck();
    const trumpSuit = deck[deck.length - 1].suit;
    deck.forEach(c => c.trump = c.suit === trumpSuit);

    const game = {
      id,
      players: [{ id: socket.id, name: playerName, hand: [] }],
      deck,
      trump: trumpSuit,
      turn: 0,
      table: [],
      status: 'waiting',
      phase: 'attack',
    };
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

  function startGame(game, room) {
    for (let i = 0; i < 6; i++) {
      game.players[0].hand.push(game.deck.pop());
      game.players[1].hand.push(game.deck.pop());
    }
    game.status = 'playing';
    game.phase = 'attack';
    io.to(room).emit('gameState', game);
  }

  function drawCards(game) {
    const attacker = game.players[game.turn];
    const defender = game.players[1 - game.turn];
    [attacker, defender].forEach(p => {
      while (p.hand.length < 6 && game.deck.length > 0) {
        p.hand.push(game.deck.pop());
      }
    });
  }

  function checkGameOver(game, room) {
    const alive = game.players.filter(p => p.hand.length > 0);
    if (game.deck.length === 0 && alive.length <= 1) {
      game.status = 'gameOver';
      game.winner = alive[0]?.name || 'Ничья';
      io.to(room).emit('gameState', game);
      return true;
    }
    return false;
  }

  socket.on('attack', (room, cardIndex) => {
    const game = games[room];
    if (!game || game.status !== 'playing') return;
    const player = game.players[game.turn];
    if (player.id !== socket.id) return;
    if (game.phase === 'defense') return; // ещё не время атаковать
    const card = player.hand[cardIndex];
    if (!card) return;

    // Проверка подкидывания: если стол не пуст, можно ходить только картой того же ранга, что уже есть на столе
    if (game.table.length > 0) {
      const allowedRanks = new Set(game.table.flatMap(p => [p.attacker.rank, p.defender?.rank]).filter(Boolean));
      if (!allowedRanks.has(card.rank)) return; // нельзя подкинуть
    }

    player.hand.splice(cardIndex, 1);
    game.table.push({ attacker: card });
    game.phase = 'defense';
    io.to(room).emit('gameState', game);
  });

  socket.on('defend', (room, attackIndex, defendIndex) => {
    const game = games[room];
    if (!game || game.status !== 'playing' || game.phase !== 'defense') return;
    const defender = game.players[1 - game.turn];
    if (defender.id !== socket.id) return;
    const attackCard = game.table[attackIndex]?.attacker;
    const defendCard = defender.hand[defendIndex];
    if (!attackCard || !defendCard || game.table[attackIndex].defender) return;

    const beats = (defendCard.suit === attackCard.suit && defendCard.rank > attackCard.rank) ||
                  (defendCard.trump && !attackCard.trump) ||
                  (defendCard.trump && attackCard.trump && defendCard.rank > attackCard.rank);
    if (!beats) return;

    defender.hand.splice(defendIndex, 1);
    game.table[attackIndex].defender = defendCard;

    const allDefended = game.table.every(p => p.defender);
    if (allDefended) {
      game.phase = 'postBeat'; // теперь атакующий может подкинуть или завершить
    }
    io.to(room).emit('gameState', game);
  });

  socket.on('beat', (room) => {
    const game = games[room];
    if (!game || game.status !== 'playing' || game.phase !== 'postBeat') return;
    const player = game.players[game.turn];
    if (player.id !== socket.id) return;
    // все карты со стола уходят в бито (сброс)
    game.table = [];
    drawCards(game);
    if (checkGameOver(game, room)) return;
    // ход переходит к следующему игроку (защищавшийся становится атакующим)
    game.turn = 1 - game.turn;
    game.phase = 'attack';
    io.to(room).emit('gameState', game);
  });

  socket.on('take', (room) => {
    const game = games[room];
    if (!game || game.status !== 'playing') return;
    const defender = game.players[1 - game.turn];
    if (defender.id !== socket.id) return;
    // защищающийся забирает все карты со стола
    game.table.forEach(p => {
      defender.hand.push(p.attacker);
      if (p.defender) defender.hand.push(p.defender);
    });
    game.table = [];
    drawCards(game);
    if (checkGameOver(game, room)) return;
    // после взятия ход переходит к защищавшемуся (он становится атакующим)
    game.turn = 1 - game.turn;
    game.phase = 'attack';
    io.to(room).emit('gameState', game);
  });

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
