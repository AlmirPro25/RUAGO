// test/messaging.test.js
const chai = require('chai');
const chaiHttp = require('chai-http');
const ioClient = require('socket.io-client');
const mongoose = require('mongoose');

// Assuming your server file is server.js or app.js
// We need to export the server for testing, or start it if it's not already running
// For this example, let's assume server.js exports the http server instance
// and Mongoose models are accessible.
const server = require('../server'); // This should be your actual server instance for chaiHttp
const User = mongoose.model('User');
const Conversation = mongoose.model('Conversation');
const Message = mongoose.model('Message');
// const Ponto = mongoose.model('Ponto'); // Assuming Ponto model exists if cleared

const expect = chai.expect;
chai.use(chaiHttp);

const API_URL = 'http://localhost:3000'; // Or your server's port

describe('Messaging API and Socket.IO', () => {
    let user1Token, user2Token;
    let user1Details, user2Details;
    let testConversationId;
    let testSocketClient;

    // Helper to register and login a user
    const registerAndLoginUser = async (userData) => {
        // Register
        await chai.request(server).post('/api/auth/register').send(userData);
        // Login
        const res = await chai.request(server).post('/api/auth/login').send({
            email: userData.email,
            password: userData.password
        });
        return { token: res.body.token, user: res.body };
    };

    before(async () => {
        // Clear test database before starting
        await User.deleteMany({});
        await Conversation.deleteMany({});
        await Message.deleteMany({});
        // if (Ponto) await Ponto.deleteMany({}); // If Ponto model is relevant

        // Create and login two users
        const user1Data = { name: 'Test User 1 (Cliente)', email: 'user1@test.com', password: 'password123', userType: 'cliente' };
        const user2Data = { name: 'Test User 2 (Vendedor)', email: 'user2@test.com', password: 'password123', userType: 'vendedor' };

        const login1 = await registerAndLoginUser(user1Data);
        user1Token = login1.token;
        user1Details = login1.user;

        const login2 = await registerAndLoginUser(user2Data);
        user2Token = login2.token;
        user2Details = login2.user;
    });

    after(async () => {
        if (testSocketClient && testSocketClient.connected) {
            testSocketClient.disconnect();
        }
        // Close connections after tests are done
        await mongoose.connection.close();
        server.close(); // Close the HTTP server instance
    });

    describe('API Tests - Messaging Endpoints', () => {
        it('should return 401 for POST /api/messages if not authenticated', (done) => {
            chai.request(server)
                .post('/api/messages')
                .send({ receiverId: user2Details.userId, message: 'Hello' })
                .end((err, res) => {
                    expect(res).to.have.status(401);
                    done();
                });
        });

        it('should return 400 for POST /api/messages if receiverId is missing', (done) => {
            chai.request(server)
                .post('/api/messages')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ message: 'Hello without receiver' })
                .end((err, res) => {
                    expect(res).to.have.status(400);
                    expect(res.body.message).to.equal('receiverId is required.');
                    done();
                });
        });

        it('should create a new conversation and send the first message (User1 to User2)', (done) => {
            chai.request(server)
                .post('/api/messages')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ receiverId: user2Details.userId, message: 'Hello User2, this is User1!' })
                .end((err, res) => {
                    expect(res).to.have.status(201);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('text', 'Hello User2, this is User1!');
                    expect(res.body).to.have.property('sender');
                    expect(res.body.sender._id).to.equal(user1Details.userId);
                    expect(res.body).to.have.property('conversationId');
                    testConversationId = res.body.conversationId; // Save for later tests
                    done();
                });
        });

        it('should send a message to an existing conversation (User2 to User1)', async () => {
            const initialConvoCount = await Conversation.countDocuments();
            const res = await chai.request(server)
                .post('/api/messages')
                .set('Authorization', `Bearer ${user2Token}`)
                .send({ receiverId: user1Details.userId, message: 'Hi User1, User2 here!' });

            expect(res).to.have.status(201);
            expect(res.body.text).to.equal('Hi User1, User2 here!');
            expect(res.body.sender._id).to.equal(user2Details.userId);
            expect(res.body.conversationId).to.equal(testConversationId);

            const finalConvoCount = await Conversation.countDocuments();
            expect(finalConvoCount).to.equal(initialConvoCount); // No new conversation should be created
        });

        it('should get or create a conversation without sending a message (User1 to User2, message: null)', (done) => {
            chai.request(server)
                .post('/api/messages')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ receiverId: user2Details.userId, message: null })
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.property('id', testConversationId); // Should be the same conversation
                    expect(res.body).to.have.property('recipient');
                    expect(res.body.recipient.id).to.equal(user2Details.userId);
                    expect(res.body.recipient.name).to.equal(user2Details.name);
                    expect(res.body).to.have.property('lastMessage', null);
                    done();
                });
        });


        it('should list conversations for User1 (expects 1 conversation, 1 unread from User2)', (done) => {
            chai.request(server)
                .get('/api/messages/conversations')
                .set('Authorization', `Bearer ${user1Token}`)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('array').with.lengthOf(1);
                    const convo = res.body[0];
                    expect(convo._id).to.equal(testConversationId);
                    expect(convo.lastMessage.text).to.equal('Hi User1, User2 here!');
                    expect(convo.participants.some(p => p._id === user2Details.userId)).to.be.true;
                    expect(convo.unreadCount).to.equal(1); // User2's reply should be unread for User1
                    done();
                });
        });

        it('should list conversations for User2 (expects 1 conversation, 0 unread)', (done) => {
            // Note: User2 sent the last message, so no unread for them from that message.
            // User1's first message was technically "read" by User1 (sender is in readBy).
            // For User2 to have unread, User1 would need to send another message after User2's reply.
            chai.request(server)
                .get('/api/messages/conversations')
                .set('Authorization', `Bearer ${user2Token}`)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('array').with.lengthOf(1);
                    const convo = res.body[0];
                    expect(convo._id).to.equal(testConversationId);
                    expect(convo.lastMessage.text).to.equal('Hi User1, User2 here!');
                    expect(convo.unreadCount).to.equal(0); // User1's first message is not counted as unread for User2 by current logic.
                                                           // User2 sent the last message.
                    done();
                });
        });

        it('should get messages for the specific conversation', (done) => {
            chai.request(server)
                .get(`/api/messages/conversations/${testConversationId}`)
                .set('Authorization', `Bearer ${user1Token}`)
                .end((err, res) => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('array').with.lengthOf(2);
                    expect(res.body[0].text).to.equal('Hello User2, this is User1!');
                    expect(res.body[1].text).to.equal('Hi User1, User2 here!');
                    done();
                });
        });

        it('User1 marks messages from User2 as read, unreadCount should be 0', async () => {
            const res = await chai.request(server)
                .put(`/api/messages/conversations/${testConversationId}/read`)
                .set('Authorization', `Bearer ${user1Token}`);

            expect(res).to.have.status(200);
            expect(res.body.success).to.be.true;
            expect(res.body.message).to.include('Marked messages as read.');

            // Re-fetch conversations for User1 to check unreadCount
            const updatedConvosRes = await chai.request(server)
                .get('/api/messages/conversations')
                .set('Authorization', `Bearer ${user1Token}`);

            expect(updatedConvosRes.body[0].unreadCount).to.equal(0);
        });
    });

    describe('Socket.IO Tests - Real-time Messaging', () => {
        before((done) => {
            // Setup Socket.IO client for User2 to receive messages
            // Ensure server is running and accessible at API_URL for socket connection
            testSocketClient = ioClient(API_URL, {
                reconnection: false, // Disable reconnection for tests
                forceNew: true,      // Ensure a new connection
                transports: ['websocket'], // Use websocket transport
                auth: { token: user2Token } // Authenticate User2's socket connection
            });

            testSocketClient.on('connect', () => {
                // console.log('Test Socket Client (User2) connected for testing.');
                done();
            });

            testSocketClient.on('connect_error', (error) => {
                console.error('Test Socket Client connection error:', error.message);
                // If connection fails, we might want to fail the tests or handle it
                done(error); // Propagate error to Mocha to fail the setup
            });
        });

        after(() => {
            if (testSocketClient && testSocketClient.connected) {
                // console.log('Disconnecting Test Socket Client (User2).');
                testSocketClient.disconnect();
            }
        });

        it('User2 should receive a "new_message" event when User1 sends a message to their conversation', (done) => {
            const messageToSend = 'Live message from User1 to User2!';

            // User2's client listens for the new message
            testSocketClient.on('new_message', (message) => {
                expect(message).to.be.an('object');
                expect(message.text).to.equal(messageToSend);
                expect(message.sender._id).to.equal(user1Details.userId);
                expect(message.conversationId).to.equal(testConversationId);
                // Clean up listener to prevent multiple triggers if test setup changes
                testSocketClient.off('new_message');
                done();
            });

            // User1 sends a message via HTTP, triggering the socket event
            chai.request(server)
                .post('/api/messages')
                .set('Authorization', `Bearer ${user1Token}`)
                .send({ receiverId: user2Details.userId, message: messageToSend })
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res).to.have.status(201);
                    // The event handler for 'new_message' on testSocketClient should handle 'done()'
                });
        });
    });
});
