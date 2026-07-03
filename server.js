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

// Полный набор из 40 клеток (классическая монополия)
function createFullBoard() {
  return [
    { name: 'Старт', type: 'start' },
    { name: 'Житная ул.', price: 60, rent: [2,10,30,90,160,250], housePrice: 50, owner: null, houses: 0, group: 'brown' },
    { name: 'Казна', type: 'chest' },
    { name: 'Нагатинская ул.', price: 60, rent: [4,20,60,180,320,450], housePrice: 50, owner: null, houses: 0, group: 'brown' },
    { name: 'Подоходный налог', type: 'tax', amount: 100 },
    { name: 'Варшавский вокзал', price: 200, rent: [25,50,100,200], housePrice: 0, owner: null, houses: 0, group: 'station' },
    { name: 'Рижская ул.', price: 100, rent: [6,30,90,270,400,550], housePrice: 50, owner: null, houses: 0, group: 'lightblue' },
    { name: 'Шанс', type: 'chance' },
    { name: 'Тверская ул.', price: 100, rent: [6,30,90,270,400,550], housePrice: 50, owner: null, houses: 0, group: 'lightblue' },
    { name: 'Пушкинская ул.', price: 120, rent: [8,40,100,300,450,600], housePrice: 50, owner: null, houses: 0, group: 'lightblue' },
    { name: 'Тюрьма (только посещение)', type: 'jail' },
    { name: 'Смоленская ул.', price: 140, rent: [10,50,150,450,625,750], housePrice: 100, owner: null, houses: 0, group: 'pink' },
    { name: 'Электростанция', price: 150, rent: [0], housePrice: 0, owner: null, houses: 0, group: 'utility' },
    { name: 'Красная Пресня', price: 140, rent: [10,50,150,450,625,750], housePrice: 100, owner: null, houses: 0, group: 'pink' },
    { name: 'Кутузовский просп.', price: 160, rent: [12,60,180,500,700,900], housePrice: 100, owner: null, houses: 0, group: 'pink' },
    { name: 'Рижский вокзал', price: 200, rent: [25,50,100,200], housePrice: 0, owner: null, houses: 0, group: 'station' },
    { name: 'Пятницкая ул.', price: 180, rent: [14,70,200,550,750,950], housePrice: 100, owner: null, houses: 0, group: 'orange' },
    { name: 'Казна', type: 'chest' },
    { name: 'Неглинная ул.', price: 180, rent: [14,70,200,550,750,950], housePrice: 100, owner: null, houses: 0, group: 'orange' },
    { name: 'Тверской бульвар', price: 200, rent: [16,80,220,600,800,1000], housePrice: 100, owner: null, houses: 0, group: 'orange' },
    { name: 'Бесплатная стоянка', type: 'parking' },
    { name: 'Арбат', price: 220, rent: [18,90,250,700,875,1050], housePrice: 150, owner: null, houses: 0, group: 'red' },
    { name: 'Шанс', type: 'chance' },
    { name: 'Сретенка', price: 220, rent: [18,90,250,700,875,1050], housePrice: 150, owner: null, houses: 0, group: 'red' },
    { name: 'Мясницкая ул.', price: 240, rent: [20,100,300,750,925,1100], housePrice: 150, owner: null, houses: 0, group: 'red' },
    { name: 'Казанский вокзал', price: 200, rent: [25,50,100,200], housePrice: 0, owner: null, houses: 0, group: 'station' },
    { name: 'Манежная ул.', price: 260, rent: [22,110,330,800,975,1150], housePrice: 150, owner: null, houses: 0, group: 'yellow' },
    { name: 'Театральная ул.', price: 260, rent: [22,110,330,800,975,1150], housePrice: 150, owner: null, houses: 0, group: 'yellow' },
    { name: 'Водопровод', price: 150, rent: [0], housePrice: 0, owner: null, houses: 0, group: 'utility' },
    { name: 'Никитская ул.', price: 280, rent: [24,120,360,850,1025,1200], housePrice: 150, owner: null, houses: 0, group: 'yellow' },
    { name: 'Отправляйтесь в тюрьму', type: 'goToJail' },
    { name: 'Гоголевский бульвар', price: 300, rent: [26,130,390,900,1100,1275], housePrice: 200, owner: null, houses: 0, group: 'green' },
    { name: 'Казна', type: 'chest' },
    { name: 'Петровка', price: 300, rent: [26,130,390,900,1100,1275], housePrice: 200, owner: null, houses: 0, group: 'green' },
    { name: 'Страстной бульвар', price: 320, rent: [28,150,450,1000,1200,1400], housePrice: 200, owner: null, houses: 0, group: 'green' },
    { name: 'Ленинградский вокзал', price: 200, rent: [25,50,100,200], housePrice: 0, owner: null, houses: 0, group: 'station' },
    { name: 'Шанс', type: 'chance' },
    { name: 'Малая Бронная', price: 350, rent: [35,175,500,1100,1300,1500], housePrice: 200, owner: null, houses: 0, group: 'darkblue' },
    { name: 'Налог на роскошь', type: 'tax', amount: 75 },
    { name: 'Тверская-Ямская', price: 400, rent: [50,200,600,1400,1700,2000], housePrice: 200, owner: null, houses: 0, group: 'darkblue' },
  ];
}

const chanceCards = [
  { text: 'Банк выплачивает вам 50', action: p => p.money += 50 },
  { text: 'Вы выиграли в лотерею 100!', action: p => p.money += 100 },
  { text: 'Оплатите штраф 30', action: p => p.money -= 30 },
  { text: 'Вас оштрафовали на 20', action: p => p.money -= 20 },
  { text: 'Получите наследство 150', action: p => p.money += 150 },
  { text: 'Отправляйтесь в тюрьму', action: p => { p.position = 10; p.inJail = true; } },
  { text: 'Вы освобождены из тюрьмы (сохраните карту)', action: p => { p.inJail = false; } },
];

const chestCards = [
  { text: 'Банковская ошибка в вашу пользу — получите 200', action: p => p.money += 200 },
  { text: 'Выгодная продажа — получите 75', action: p => p.money += 75 },
  { text: 'Оплатите ремонт 40', action: p => p.money -= 40 },
  { text: 'Сбор за парковку — заплатите 25', action: p => p.money -= 25 },
  { text: 'Освобождение из тюрьмы', action: p => { p.inJail = false; } },
  { text: 'Штраф за нарушение — заплатите 50', action: p => p.money -= 50 },
];

io.on('connection', (socket) => {
  socket.on('createRoom', (playerName) => {
    const id = roomId();
    const game = {
      id,
      players: [{ id: socket.id, name: playerName, money: 1500, position: 0, inJail: false, color: '#e74c3c' }],
      board: createFullBoard(),
      currentTurn: 0,
      dice: [1, 1],
      status: 'waiting',
      chat: [],
      chanceDeck: shuffle([...chanceCards]),
      chestDeck: shuffle([...chestCards]),
    };
    games[id] = game;
    socket.join(id);
    socket.emit('gameState', game);
  });

  socket.on('joinRoom', (room, playerName) => {
    const game = games[room];
    if (!game) return socket.emit('error', 'Комната не найдена');
    if (game.players.length >= 4) return socket.emit('error', 'Комната заполнена');
    const colors = ['#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
    game.players.push({
      id: socket.id,
      name: playerName,
      money: 1500,
      position: 0,
      inJail: false,
      color: colors[game.players.length],
    });
    socket.join(room);
    io.to(room).emit('gameState', game);
  });

  socket.on('rollDice', (room) => {
    const game = games[room];
    if (!game || game.players[game.currentTurn].id !== socket.id || game.status === 'gameOver') return;
    const player = game.players[game.currentTurn];
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    game.dice = [d1, d2];

    if (player.inJail) {
      if (d1 === d2) {
        player.inJail = false;
        io.to(room).emit('message', `${player.name} выходит из тюрьмы!`);
      } else {
        player.money -= 50;
        io.to(room).emit('message', `${player.name} платит 50 и остаётся в тюрьме.`);
        endTurn(game, room);
        io.to(room).emit('gameState', game);
        return;
      }
    }

    player.position = (player.position + d1 + d2) % game.board.length;
    const cell = game.board[player.position];
    handleCell(game, room, player, cell);
    if (player.money <= 0) bankrupt(game, room, player);
    if (game.status !== 'gameOver') endTurn(game, room);
    io.to(room).emit('gameState', game);
  });

  function handleCell(game, room, player, cell) {
    if (cell.type === 'goToJail') {
      player.position = 10;
      player.inJail = true;
      io.to(room).emit('message', `${player.name} отправляется в тюрьму!`);
      return;
    }
    if (cell.type === 'property' && cell.owner && cell.owner !== player.id) {
      let rent;
      if (cell.group === 'station') {
        const ownerStations = game.board.filter(c => c.group === 'station' && c.owner === cell.owner).length;
        rent = cell.rent[ownerStations - 1];
      } else if (cell.group === 'utility') {
        const ownerUtils = game.board.filter(c => c.group === 'utility' && c.owner === cell.owner).length;
        rent = (ownerUtils === 2 ? 10 : 4) * (game.dice[0] + game.dice[1]);
      } else {
        rent = cell.rent[cell.houses || 0];
      }
      player.money -= rent;
      const owner = game.players.find(p => p.id === cell.owner);
      if (owner) owner.money += rent;
      io.to(room).emit('message', `${player.name} платит ${rent} аренды владельцу ${owner?.name}`);
    } else if (cell.type === 'tax') {
      player.money -= cell.amount;
      io.to(room).emit('message', `${player.name} платит налог ${cell.amount}`);
    } else if (cell.type === 'chance') {
      const card = game.chanceDeck.pop();
      if (card) {
        card.action(player);
        io.to(room).emit('message', `${player.name}: ${card.text}`);
        if (game.chanceDeck.length === 0) game.chanceDeck = shuffle([...chanceCards]);
      }
    } else if (cell.type === 'chest') {
      const card = game.chestDeck.pop();
      if (card) {
        card.action(player);
        io.to(room).emit('message', `${player.name}: ${card.text}`);
        if (game.chestDeck.length === 0) game.chestDeck = shuffle([...chestCards]);
      }
    } else if (cell.type === 'jail') {
      // просто посещение
    }
  }

  function bankrupt(game, room, player) {
    io.to(room).emit('message', `${player.name} обанкротился!`);
    game.board.forEach(c => { if (c.owner === player.id) { c.owner = null; c.houses = 0; } });
    game.players = game.players.filter(p => p.id !== player.id);
    if (game.players.length === 1) {
      game.status = 'gameOver';
      io.to(room).emit('message', `${game.players[0].name} победил!`);
    }
  }

  function endTurn(game, room) {
    game.currentTurn = (game.currentTurn + 1) % game.players.length;
  }

  socket.on('buyProperty', (room) => {
    const game = games[room];
    if (!game) return;
    const player = game.players[game.currentTurn];
    if (player.id !== socket.id) return;
    const cell = game.board[player.position];
    if (cell.type === 'property' && !cell.owner && player.money >= cell.price) {
      player.money -= cell.price;
      cell.owner = player.id;
      io.to(room).emit('message', `${player.name} покупает ${cell.name}`);
      io.to(room).emit('gameState', game);
    }
  });

  socket.on('buildHouse', (room) => {
    const game = games[room];
    if (!game) return;
    const player = game.players[game.currentTurn];
    if (player.id !== socket.id) return;
    const cell = game.board[player.position];
    if (cell.owner === player.id && (cell.houses || 0) < 5 && player.money >= cell.housePrice && hasMonopoly(game, player.id, cell.group)) {
      player.money -= cell.housePrice;
      cell.houses = (cell.houses || 0) + 1;
      io.to(room).emit('message', `${player.name} строит ${cell.houses === 5 ? 'отель' : 'дом'} на ${cell.name}`);
      io.to(room).emit('gameState', game);
    }
  });

  function hasMonopoly(game, playerId, group) {
    const groupCells = game.board.filter(c => c.group === group && c.type === 'property');
    return groupCells.every(c => c.owner === playerId);
  }

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
    for (const id in games) {
      const g = games[id];
      const idx = g.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        g.board.forEach(c => { if (c.owner === socket.id) { c.owner = null; c.houses = 0; } });
        g.players.splice(idx, 1);
        if (g.players.length === 0) delete games[id];
        else io.to(id).emit('gameState', g);
      }
    }
  });
});

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
server.listen(3000, () => console.log('http://localhost:3000'));
