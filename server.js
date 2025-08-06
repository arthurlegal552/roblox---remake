const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(__dirname));

io.on('connection', socket => {
    socket.on('chat', msg => {
        io.emit('chat', { playerId: socket.id, message: msg });
    });
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', players: Object.keys(players).length });
});

// Store connected players
let players = {};
const GAME_TICK_RATE = 20; // 20 updates per second

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Send current players to new player
    socket.emit('initialPlayers', players);
    
    // Add new player
    players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 3,
        z: 0,
        rotation: 0,
        isMoving: false,
        // Default colors
        colors: {
            head: '#FAD417',
            torso: '#00A2FF',
            arms: '#FAD417',
            legs: '#80C91C'
        }
    };
    
    // Notify other players about new player
    socket.broadcast.emit('playerJoined', players[socket.id]);
    
    // Handle player movement
    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            players[socket.id].rotation = data.rotation;
            players[socket.id].isMoving = data.isMoving;
            
            // Movement is now broadcasted by the game loop, not here.
        }
    });
    
    // Handle player color customization
    socket.on('playerCustomize', (colors) => {
        if (players[socket.id]) {
            players[socket.id].colors = colors;
            // The color change will be broadcast in the next game state update.
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        delete players[socket.id];
        socket.broadcast.emit('playerLeft', socket.id);
    });
    
    // Handle connection errors
    socket.on('connect_error', (error) => {
        console.log('Connection error:', error);
    });
});

// Server-side game loop
setInterval(() => {
    io.emit('gameState', players);
}, 1000 / GAME_TICK_RATE);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});