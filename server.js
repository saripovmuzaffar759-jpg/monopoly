const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Хранилище игр в памяти
const games = {};

// Генератор ID комнаты
function roomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Начальное состояние доски
function createBoard() {
  const cells = [
    { name: 'Старт', type: 'start' },
    { name: 'Житная ул.', price: 60, rent: 2, owner: null, type: 'property' },
    { name: 'Шанс', type: 'chance' },
    { name: 'Нагатинская ул.', price: 80, rent: 4, owner: null, type: 'property' },
    { name: 'Налог', type: 'tax', amount: 50 },
    { name: 'Варшавское шоссе', price: 200, rent: 8, owner: null, type: 'property' },
    { name: 'Казна', type: 'chest' },
    { name: 'Рублёвка', price: 260, rent: 22, owner: null, type: 'property' },
    { name: 'Тверская', price: 280, rent: 26, owner: null, type: 'property' },
    { name: 'Бесплатная стоянка', type: 'parking' },
    { name: 'Ленинский просп.', price: 320, rent: 28, owner: null, type: 'property' },
    { name: 'Шанс', type: 'chance' },
    { name: 'Кутузовский просп.', price: 340, rent: 30, owner: null, type: 'property' },
    { name: 'Арбат', price: 360, rent: 32, owner: null, type: 'property' },
    { name: 'Вокзал', price: 200, rent: 25, owner: null, type: 'property' },
    { name: 'Казна', type: 'chest' },
    { name: 'Неглинная ул.', price: 400, rent: 40, owner: null, type: 'property' },
    { name: 'Тюрьма', type: 'jail' },
  ];
  return cells;
}

const chanceCards = [
  { text: 'Банк выплачивает вам 50', action: (p) => p.money += 50 },
  { text: 'Вы выиграли в лотерею 100!', action: (p) => p.money += 100 },
  { text: 'Оплатите штраф 30', action: (p) => p.money -= 30 },
  { text: 'Вас оштрафовали на 20 за превышение скорости', action: (p) => p.money -= 20 },
  { text: 'Получите наследство 150', action: (p) => p.money += 150 },
  { text: 'Отправляйтесь в тюрьму', action: (p) => { p.position = 15; p.inJail = true; } },
];

const chestCards = [
  { text: 'Банковская ошибка в вашу пользу — получите 200', action: (p) => p.money += 200 },
  { text: 'Выгодная продажа — получите 75', action: (p) => p.money += 75 },
  { text: 'Оплатите ремонт 40', action: (p) => p.money -= 40 },
  { text: 'Сбор за парковку — заплатите 25', action: (p) => p.money -= 25 },
  { text: 'Освобождение из тюрьмы', action: (p) => { p.inJail = false; } },
  { text: 'Штраф за нарушение правил — заплатите 50', action: (p) => p.money -= 50 },
];

io.on('connection', (socket) => {
  socket.on('createRoom', (playerName) => {
    const id = roomId();
    const game = {
      id,
      players: [{ id: socket.id, name: playerName, money: 1500, position: 0, inJail: false, color: '#e74c3c' }],
      board: createBoard(),
      currentTurn: 0,
      dice: [1, 1],
      status: 'waiting',
      chat: [],
    };
    games[id] = game;
    socket.join(id);
    socket.emit('gameState', game);
    console.log(`Комната ${id} создана игроком ${playerName}`);
  });

  socket.on('joinRoom', (room, playerName) => {
    const game = games[room];
    if (!game) return socket.emit('error', 'Комната не найдена');
    if (game.players.length >= 4) return socket.emit('error', 'Комната заполнена');
    game.players.push({
      id: socket.id,
      name: playerName,
      money: 1500,
      position: 0,
      inJail: false,
      color: ['#3498db', '#2ecc71', '#f39c12'][game.players.length] || '#9b59b6',
    });
    socket.join(room);
    io.to(room).emit('gameState', game);
  });

  socket.on('rollDice', (room) => {
    const game = games[room];
    if (!game) return;
    const player = game.players[game.currentTurn];
    if (player.id !== socket.id) return;
    if (game.status === 'gameOver') return;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    game.dice = [d1, d2];

    if (player.inJail) {
      // попытка освободиться: дубль или плати 50
      if (d1 === d2) {
        player.inJail = false;
        io.to(room).emit('message', `${player.name} выходит из тюрьмы!`);
      } else {
        player.money -= 50;
        io.to(room).emit('message', `${player.name} платит 50 и остаётся в тюрьме.`);
        nextTurn(game, room);
        io.to(room).emit('gameState', game);
        return;
      }
    }

    player.position = (player.position + d1 + d2) % game.board.length;
    const cell = game.board[player.position];

    // Обработка клеток
    if (cell.type === 'property' && cell.owner === null) {
      // можно купить
    } else if (cell.type === 'property' && cell.owner !== null && cell.owner !== player.id) {
      const rent = cell.rent;
      player.money -= rent;
      const owner = game.players.find(p => p.id === cell.owner);
      if (owner) owner.money += rent;
      io.to(room).emit('message', `${player.name} платит ${rent} аренды владельцу ${owner.name}`);
    } else if (cell.type === 'tax') {
      player.money -= cell.amount;
      io.to(room).emit('message', `${player.name} платит налог ${cell.amount}`);
    } else if (cell.type === 'chance') {
      const card = chanceCards[Math.floor(Math.random() * chanceCards.length)];
      card.action(player);
      io.to(room).emit('message', `${player.name}: ${card.text}`);
    } else if (cell.type === 'chest') {
      const card = chestCards[Math.floor(Math.random() * chestCards.length)];
      card.action(player);
      io.to(room).emit('message', `${player.name}: ${card.text}`);
    } else if (cell.type === 'jail') {
      player.inJail = true;
      player.position = 15; // перемещаем на клетку тюрьмы
      io.to(room).emit('message', `${player.name} отправляется в тюрьму!`);
    }

    // Проверка банкротства
    if (player.money <= 0) {
      io.to(room).emit('message', `${player.name} обанкротился и выбывает!`);
      game.players = game.players.filter(p => p.id !== player.id);
      // убрать владения
      game.board.forEach(c => { if (c.owner === player.id) c.owner = null; });
    }

    // Проверка победы
    if (game.players.length === 1) {
      game.status = 'gameOver';
      io.to(room).emit('message', `${game.players[0].name} победил!`);
      io.to(room).emit('gameState', game);
      return;
    }

    nextTurn(game, room);
    io.to(room).emit('gameState', game);
  });

  socket.on('buyProperty', (room) => {
    const game = games[room];
    if (!game) return;
    const player = game.players[game.currentTurn];
    if (player.id !== socket.id) return;
    const cell = game.board[player.position];
    if (cell.type === 'property' && cell.owner === null && player.money >= cell.price) {
      player.money -= cell.price;
      cell.owner = player.id;
      io.to(room).emit('message', `${player.name} покупает ${cell.name} за ${cell.price}`);
      io.to(room).emit('gameState', game);
    }
  });

  socket.on('chat', (room, text) => {
    const game = games[room];
    if (!game) return;
    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;
    game.chat.push({ name: player.name, text, time: new Date().toLocaleTimeString() });
    if (game.chat.length > 30) game.chat.shift();
    io.to(room).emit('gameState', game);
  });

  socket.on('disconnect', () => {
    // удалить игрока из всех игр
    for (const id in games) {
      const g = games[id];
      const idx = g.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        g.board.forEach(c => { if (c.owner === socket.id) c.owner = null; });
        g.players.splice(idx, 1);
        if (g.players.length === 0) {
          delete games[id];
        } else {
          if (g.currentTurn >= g.players.length) g.currentTurn = 0;
          io.to(id).emit('gameState', g);
        }
      }
    }
  });
});

function nextTurn(game, room) {
  game.currentTurn = (game.currentTurn + 1) % game.players.length;
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(3000, () => console.log('Монополия на http://localhost:3000'));
