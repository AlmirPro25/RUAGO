// server.js (Simplified for messaging focus)
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Only if user registration/login is part of this server
const cors = require('cors');

const app = express();
app.use(cors()); // Basic CORS setup
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your-very-secret-key'; // Use environment variable

// --- Mongoose Models (Simplified) ---
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Hashed password
    avatar: { type: String, default: 'https://via.placeholder.com/40' }
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });
const Message = mongoose.model('Message', MessageSchema);

const ConversationSchema = new mongoose.Schema({
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
}, { timestamps: true });
const Conversation = mongoose.model('Conversation', ConversationSchema);

// --- Database Connection (MongoDB) ---
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/messagingAppTest')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// --- Authentication Middleware (Express & Socket.IO) ---
const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>
    if (!token) return res.status(401).json({ message: 'Authentication token required.' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = await User.findById(decoded.userId).select('-password');
        if (!req.user) return res.status(404).json({ message: 'User not found.' });
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

const socketAuthMiddleware = async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication token required.'));
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = await User.findById(decoded.userId).select('-password');
        if (!socket.user) return next(new Error('User not found.'));
        next();
    } catch (error) {
        next(new Error('Invalid or expired token.'));
    }
};

// --- HTTP Server & Socket.IO Setup ---
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

// Socket.IO Authentication and Connection Handling
io.use(socketAuthMiddleware);

io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.name} (ID: ${socket.user._id})`);

    try {
        const conversations = await Conversation.find({ participants: socket.user._id });
        conversations.forEach(convo => {
            socket.join(convo._id.toString());
            console.log(`User ${socket.user.name} joined room ${convo._id.toString()}`);
        });
    } catch (error) {
        console.error(`Error joining conversation rooms for user ${socket.user._id}:`, error);
    }

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.name}`);
    });
});

// --- API Routes ---
// Placeholder auth routes (implement proper registration and login)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ message: 'All fields are required.' });
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists with this email.' });
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();
        // For testing, directly create a token. In prod, login should do this.
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ message: 'User registered', token, userId: user._id, name: user.name, avatar: user.avatar });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials.' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, userId: user._id, name: user.name, email: user.email, avatar: user.avatar });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// Messaging Routes
const messagesRouter = express.Router();
messagesRouter.use(authMiddleware); // Secure all messaging routes

// POST /api/messages - Send a new message or start a conversation
messagesRouter.post('/', async (req, res) => {
    const { receiverId, message: messageText } = req.body;
    const senderId = req.user._id;

    if (!receiverId) {
        return res.status(400).json({ message: 'receiverId is required.' });
    }
    if (senderId.toString() === receiverId.toString()) {
        return res.status(400).json({ message: 'Cannot send message to yourself.'});
    }

    try {
        let conversation = await Conversation.findOneAndUpdate(
            {
                participants: { $all: [senderId, receiverId] },
            },
            {
                participants: [senderId, receiverId] // Ensure order or use $addToSet if order doesn't matter and they might not exist
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).populate('participants', 'name avatar');


        // If messageText is null/undefined, client is just trying to ensure conversation exists (e.g., "Chat with vendor")
        if (!messageText) {
             // Find the recipient user model to return their details
            const recipient = await User.findById(receiverId).select('name avatar');
            if (!recipient) return res.status(404).json({ message: 'Recipient user not found.' });

            return res.status(200).json({
                id: conversation._id, // conversation ID
                // lastMessage: null, // No message sent
                // unreadCount: 0, // No message sent
                // timestamp: conversation.updatedAt, // or createdAt if preferred for "chat started"
                recipient: { // Mimicking the structure from frontend's startOrOpenChatWith
                    id: recipient._id,
                    name: recipient.name,
                    avatar: recipient.avatar
                },
                // For consistency with how conversations are normally returned, include participants
                participants: conversation.participants.map(p => ({id: p._id, name: p.name, avatar: p.avatar})),
                lastMessage: null, // Explicitly null as no message was created
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt
            });
        }


        const message = new Message({
            conversationId: conversation._id,
            sender: senderId,
            text: messageText,
            readBy: [senderId] // Sender has implicitly read the message
        });
        await message.save();

        conversation.lastMessage = message._id;
        await conversation.save();

        // Populate message sender details for the event and response
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'name avatar _id')
            .populate('readBy', 'name avatar _id') // Though readBy might be less critical for immediate emit
            .lean(); // Use .lean() for plain JS object for emit & response


        // Emit to all participants in the conversation room
        conversation.participants.forEach(participant => {
            // Ensure this socket user is joined to the room if they are online
            // The initial join happens on connection, this is more of a broadcast
            io.to(conversation._id.toString()).emit('new_message', populatedMessage);
        });
         // Also ensure new conversation is joined by both parties if they are online
        const senderSocket = findSocketByUserId(senderId.toString());
        if (senderSocket) senderSocket.join(conversation._id.toString());

        const receiverSocket = findSocketByUserId(receiverId.toString());
        if (receiverSocket) receiverSocket.join(conversation._id.toString());


        res.status(201).json(populatedMessage);

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Server error while sending message.' });
    }
});


// GET /api/messages/conversations - List all conversations for the logged-in user
messagesRouter.get('/conversations', async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.user._id })
            .populate({
                path: 'participants',
                select: 'name avatar _id'
            })
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'name avatar _id' }
            })
            .sort({ updatedAt: -1 });

        const conversationsWithUnread = await Promise.all(
            conversations.map(async (convo) => {
                if (!convo.lastMessage) { // Handle conversations with no messages yet
                     return {
                        ...convo.toObject(),
                        recipient: convo.participants.find(p => p._id.toString() !== req.user._id.toString()) || convo.participants[0], // Basic fallback
                        unreadCount: 0,
                        lastMessage: null // Ensure lastMessage is explicitly null or an empty object
                    };
                }
                const unreadCount = await Message.countDocuments({
                    conversationId: convo._id,
                    _id: convo.lastMessage._id, // Only check the last message for unread status for the summary
                    readBy: { $nin: [req.user._id] }
                });
                 // More accurate unread count: count all messages in the convo not read by user
                const totalUnreadInConvo = await Message.countDocuments({
                    conversationId: convo._id,
                    sender: { $ne: req.user._id }, // Messages not sent by the current user
                    readBy: { $nin: [req.user._id] } // And not read by the current user
                });

                // Determine the recipient for the frontend structure
                const recipient = convo.participants.find(p => p._id.toString() !== req.user._id.toString()) || convo.participants[0];


                return {
                    ...convo.toObject(), // Converts mongoose doc to plain object
                    recipient: recipient ? { id: recipient._id, name: recipient.name, avatar: recipient.avatar } : null,
                    unreadCount: totalUnreadInConvo,
                };
            })
        );
        res.json(conversationsWithUnread);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/messages/conversations/:conversationId - Get all messages for a specific conversation
messagesRouter.get('/conversations/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        // Validate user is part of this conversation
        const conversation = await Conversation.findOne({ _id: conversationId, participants: req.user._id });
        if (!conversation) {
            return res.status(403).json({ message: "Access denied or conversation not found." });
        }

        const messages = await Message.find({ conversationId })
            .populate('sender', 'name avatar _id')
            .sort({ createdAt: 'asc' }); // Typically messages are shown oldest to newest
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages for conversation:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/messages/conversations/:conversationId/read - Mark messages in a conversation as read
messagesRouter.put('/conversations/:conversationId/read', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        // Validate user is part of this conversation
        const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
        if (!conversation) {
            return res.status(403).json({ message: "Access denied or conversation not found." });
        }

        // Update messages sent by others that the current user hasn't read yet
        const result = await Message.updateMany(
            {
                conversationId: conversationId,
                sender: { $ne: userId }, // Only mark messages sent by OTHERS as read by current user
                readBy: { $nin: [userId] } // Where user is not already in readBy
            },
            { $addToSet: { readBy: userId } } // Add user to readBy array
        );

        // Optional: Emit an event if other clients need to know about read status changes in real-time
        // io.to(conversationId.toString()).emit('messages_read', { conversationId, userId, count: result.nModified });
        // For now, client refreshes conversation list which recalculates unread counts

        res.json({ success: true, message: `Marked messages as read. Modified count: ${result.modifiedCount}` });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.use('/api/messages', messagesRouter);

// --- Utility function to find a socket by user ID (basic example) ---
function findSocketByUserId(userId) {
    // This is a simplified way; for production, manage sockets more robustly (e.g., in a Map)
    for (const [id, socket] of io.of("/").sockets) {
        if (socket.user && socket.user._id.toString() === userId) {
            return socket;
        }
    }
    return null;
}

// --- Server Start ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Basic User data seeding for testing (if needed, run once or use a script)
async function seedUsers() {
    try {
        await User.deleteMany({}); // Clear existing users
        const users = [
            { name: 'Current User', email: 'currentUser@example.com', password: 'password1' },
            { name: 'Vendor Owner 2', email: 'vendor2@example.com', password: 'password2' },
            { name: 'User Three', email: 'user3@example.com', password: 'password3' },
            { name: 'User Four', email: 'user4@example.com', password: 'password4' },
        ];
        for (const userData of users) {
            const hashedPassword = await bcrypt.hash(userData.password, 12);
            await new User({ ...userData, password: hashedPassword }).save();
        }
        console.log('Users seeded.');
    } catch (error) {
        console.error('Error seeding users:', error);
    }
}

// Call this if you need to seed data, e.g., after DB connection
// mongoose.connection.once('open', () => {
//     User.countDocuments().then(count => {
//         if (count === 0) seedUsers();
//     });
// });
