require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./auth-routes');
const friendRoutes = require('./friends-routes');
const chatRoutes = require('./chats-routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'Snaple API is running' }));

app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/chats', chatRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Snaple API running on port ${port}`));
