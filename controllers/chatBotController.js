
const mongoose = require('mongoose');

const Chat = require('../models/chatBotModel');
const User = require('../models/userModel');

const { generateReply } = require('../services/auraService');


// Get authenticated user ID
const getUserId = (req) => {

  return req.user?.id || req.user?._id;

};


// Validate MongoDB ID
const validId = (id) => {

  return mongoose.isValidObjectId(id);

};


// -----------------------------------------
// 1. CREATE NEW CHAT
// POST /api/chats
// -----------------------------------------

exports.createChat = async (req, res) => {

  try {

    const userId = getUserId(req);

    if (!userId) {

      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });

    }

    const chat = await Chat.create({

      userId,

      title: 'New Chat',

      messages: []

    });

    return res.status(201).json({

      success: true,

      message: 'New chat created successfully',

      chat

    });

  } catch (error) {

    console.error('Create Chat Error:', error);

    return res.status(500).json({

      success: false,
      message: 'Could not create chat'

    });

  }

};


// -----------------------------------------
// 2. GET ALL USER CHATS
// GET /api/chats
// -----------------------------------------

exports.listChats = async (req, res) => {

  try {

    const userId = getUserId(req);

    const chats = await Chat.find({

      userId

    })

    .select('title createdAt updatedAt')

    .sort({

      updatedAt: -1

    })

    .limit(100)

    .lean();


    return res.status(200).json({

      success: true,

      total: chats.length,

      chats

    });

  } catch (error) {

    console.error('List Chats Error:', error);

    return res.status(500).json({

      success: false,
      message: 'Could not load chat history'

    });

  }

};


// -----------------------------------------
// 3. GET PARTICULAR CHAT
// GET /api/chats/:chatId
// -----------------------------------------

exports.getChat = async (req, res) => {

  try {

    const { chatId } = req.params;

    const userId = getUserId(req);


    if (!validId(chatId)) {

      return res.status(400).json({

        success: false,
        message: 'Invalid chat ID'

      });

    }


    const chat = await Chat.findOne({

      _id: chatId,

      userId

    });


    if (!chat) {

      return res.status(404).json({

        success: false,
        message: 'Chat not found'

      });

    }


    return res.status(200).json({

      success: true,

      chat

    });

  } catch (error) {

    console.error('Get Chat Error:', error);

    return res.status(500).json({

      success: false,
      message: 'Could not load conversation'

    });

  }

};


// -----------------------------------------
// 4. DELETE CHAT
// DELETE /api/chats/:chatId
// -----------------------------------------

exports.deleteChat = async (req, res) => {

  try {

    const { chatId } = req.params;

    const userId = getUserId(req);


    if (!validId(chatId)) {

      return res.status(400).json({

        success: false,
        message: 'Invalid chat ID'

      });

    }


    const result = await Chat.deleteOne({

      _id: chatId,

      userId

    });


    if (!result.deletedCount) {

      return res.status(404).json({

        success: false,
        message: 'Chat not found'

      });

    }


    return res.status(200).json({

      success: true,

      message: 'Chat deleted successfully'

    });

  } catch (error) {

    console.error('Delete Chat Error:', error);

    return res.status(500).json({

      success: false,
      message: 'Could not delete chat'

    });

  }

};


// -----------------------------------------
// 5. SEND MESSAGE
// POST /api/chats/:chatId/messages
// -----------------------------------------

exports.sendMessage = async (req, res) => {

  try {

    const userId = getUserId(req);

    const { chatId } = req.params;

    const content = req.body?.message;


    // Validate message

    if (
      typeof content !== 'string' ||
      !content.trim() ||
      content.length > 4000
    ) {

      return res.status(400).json({

        success: false,

        message: 'Message must contain 1-4000 characters'

      });

    }


    if (!validId(chatId)) {

      return res.status(400).json({

        success: false,

        message: 'Invalid chat ID'

      });

    }


    // Find chat belonging to authenticated user

    const chat = await Chat.findOne({

      _id: chatId,

      userId

    });


    if (!chat) {

      return res.status(404).json({

        success: false,

        message: 'Chat not found'

      });

    }


    // Fetch user profile

    // Only select fields that are safe to expose to the chatbot.

    const user = await User.findById(userId)

      .select(
        'name email headline education skills experience targetRole'
      )

      .lean();


    if (!user) {

      return res.status(404).json({

        success: false,

        message: 'User not found'

      });

    }


    // Prepare conversation history

    const history = [

      ...chat.messages.map(message => ({

        role: message.role,

        content: message.content

      })),

      {

        role: 'user',

        content: content.trim()

      }

    ];


    // Generate response

    // Greetings and profile queries do not call GPT.

    const reply = await generateReply({

      messages: history,

      user

    });


    // Automatically generate chat title from first message

    const title = chat.messages.length === 0

      ? content.trim().slice(0, 70)

      : chat.title;


    // Save both user message and assistant response

    const updatedChat = await Chat.findOneAndUpdate(

      {

        _id: chatId,

        userId

      },

      {

        $push: {

          messages: {

            $each: [

              {

                role: 'user',

                content: content.trim()

              },

              {

                role: 'assistant',

                content: reply

              }

            ]

          }

        },

        $set: {

          title

        }

      },

      {

        new: true,

        runValidators: true

      }

    );


    if (!updatedChat) {

      return res.status(404).json({

        success: false,

        message: 'Chat no longer exists'

      });

    }


    return res.status(200).json({

      success: true,

      chatId: updatedChat._id,

      title: updatedChat.title,

      reply,

      messages: updatedChat.messages.slice(-2)

    });


  } catch (error) {

    console.error('AURA Message Error:', error);

    return res.status(500).json({

      success: false,

      message: 'Unable to respond right now. Please try again.'

    });

  }

};
