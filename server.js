const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const activeUsers = new Set();
const messages = [];

io.on('connection', (socket) => {
    let currentUser = '';

    socket.on('join-chat', ({ username, answer }) => {
        if (parseInt(answer) !== 67) {
            socket.emit('auth-error', 'Incorrect favorite number! Access denied.');
            return;
        }
        if (!username || username.trim() === '') {
            socket.emit('auth-error', 'Please enter a valid username.');
            return;
        }

        currentUser = username.trim();
        activeUsers.add(currentUser);
        socket.emit('auth-success');
        socket.emit('load-history', messages);
        io.emit('update-users', Array.from(activeUsers));

        const joinMsg = { user: 'System', text: `${currentUser} joined the chat.`, system: true };
        messages.push(joinMsg);
        io.emit('new-message', joinMsg);
    });

    socket.on('send-message', (text) => {
        if (!currentUser) return;
        const msg = { user: currentUser, text: text, system: false };
        messages.push(msg);
        if (messages.length > 100) messages.shift();
        io.emit('new-message', msg);
    });

    socket.on('disconnect', () => {
        if (currentUser) {
            activeUsers.delete(currentUser);
            io.emit('update-users', Array.from(activeUsers));
            const leaveMsg = { user: 'System', text: `${currentUser} left the chat.`, system: true };
            messages.push(leaveMsg);
            io.emit('new-message', leaveMsg);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
