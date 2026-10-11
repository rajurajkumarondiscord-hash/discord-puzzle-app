const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const activeUsers = new Set();
const channels = ['general-chat', 'blood-pit'];
const messages = {
    'general-chat': [],
    'blood-pit': []
};

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
        socket.emit('init-data', { channels, messages });
        io.emit('update-users', Array.from(activeUsers));

        const joinMsg = { user: 'System', text: `${currentUser} joined the chat.`, system: true };
        for (let ch in messages) {
            messages[ch].push(joinMsg);
            if (messages[ch].length > 100) messages[ch].shift();
        }
        io.emit('new-message', { channel: 'general-chat', message: joinMsg });
    });

    socket.on('create-channel', (channelName) => {
        const cleanName = channelName.trim().toLowerCase().replace(/\s+/g, '-');
        if (cleanName && !channels.includes(cleanName)) {
            channels.push(cleanName);
            messages[cleanName] = [];
            io.emit('update-channels', channels);
        }
    });

    socket.on('rename-channel', ({ oldName, newName }) => {
        const cleanName = newName.trim().toLowerCase().replace(/\s+/g, '-');
        const index = channels.indexOf(oldName);
        if (index !== -1 && cleanName && !channels.includes(cleanName)) {
            channels[index] = cleanName;
            messages[cleanName] = messages[oldName] || [];
            delete messages[oldName];
            io.emit('update-channels', channels);
        }
    });

    socket.on('send-message', ({ channel, text }) => {
        if (!currentUser || !messages[channel]) return;
        const msg = { user: currentUser, text: text, system: false };
        messages[channel].push(msg);
        if (messages[channel].length > 100) messages[channel].shift();
        io.emit('new-message', { channel, message: msg });
    });

    socket.on('disconnect', () => {
        if (currentUser) {
            activeUsers.delete(currentUser);
            io.emit('update-users', Array.from(activeUsers));
            const leaveMsg = { user: 'System', text: `${currentUser} left the chat.`, system: true };
            for (let ch in messages) {
                messages[ch].push(leaveMsg);
            }
            io.emit('new-message', { channel: 'general-chat', message: leaveMsg });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
