const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { jwtDecode } = require("jwt-decode");
const cloudinary = require("cloudinary").v2;
const sendError = require("./utils/sendError");
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const port = process.env.PORT || 2000;

app.use(cors());
app.use(express.json());

// const verifyToken=(req,res,next)=>{
//   const authorization=req.headers.authorization;
//   if(!authorization){
//     return res.status(401).send({status:false,message:"You are unauthorized"});
//   }
//   const token=authorization.split(" ")[1];
//   jwt.verify(token,process.env.ACCESS_TOKEN,(error,decoded)=>{
//     if(error){
//       return res.status(403).send({
//         status:false,
//         message:"Forbidden access",
//         error,
//       });
//     }
//     req.decoded=decoded;
//     next();
//   });
// };

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@bookshelfcluster.p3s31ub.mongodb.net/?ssl=true&retryWrites=true&w=majority&appName=bookshelfCluster`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("bookshelf");

    const booksCollection = db.collection("books");
    const newsCollection = db.collection("news");
    const eventsCollection = db.collection("events");
    const membersCollection = db.collection("community_member");
    const usersCollection = db.collection("users");
    const cartCollection = db.collection("cart");
    const usersResponsesCollection = db.collection("users_responses");
    const eventJoinCollection = db.collection("event_join");
    const conversationsCollection = db.collection("conversations");
    const messageRequestsCollection = db.collection("message_request");

    app.put("/users/profile_image/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const { image } = req.body;

        if (!email || !image) {
          return res.status(400).send({
            success: false,
            message: "Email and image are required",
          });
        }

        const result = await usersCollection.updateOne(
          { email },
          {
            $set: {
              image,
            },
          }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        res.send({
          success: true,
          message: "Profile image updated successfully",
          modifiedCount: result.modifiedCount,
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });

    app.delete("/delete-image", async (req, res) => {
      try {
        const { public_id } = req.body;

        if (!public_id) {
          return res.status(400).send({
            success: false,
            message: "public_id is required",
          });
        }

        const result = await cloudinary.uploader.destroy(public_id);

        if (result.result === "ok") {
          return res.status(200).send({
            success: true,
            message: "Image deleted successfully",
          });
        }

        return res.status(404).send({
          success: false,
          message: "Image not found",
        });
      } catch (error) {
        return sendError(res, error);
      }
    });

    /* ========================= BOOK ========================= */

    app.get("/books", async (req, res) => {
      try {
        const books = await booksCollection.find().toArray();
        res.send(books);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.get("/book/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await booksCollection.find({
          _id: new ObjectId(id),
        }).toArray();

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post("/book", async (req, res) => {
      try {
        const result = await booksCollection.insertOne(req.body);
        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.put("/books/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const book = req.body;

        const result = await booksCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              book_name: book.book_name,
              author_name: book.author_name,
              publisher_name: book.publisher_name,
              publication_date: book.publication_date,
              language: book.language,
              genre: book.genre,
              number_of_pages: book.number_of_pages,
              dimensions: {
                height: book.dimensions.height,
                width: book.dimensions.width,
                depth: book.dimensions.depth,
              },
              price: book.price,
              stock: book.stock,
              available: book.available,
              description: book.description,
              keywords: book.keywords,
              cover_image: book.cover_image,
              public_id: book.public_id,
            },
          }
        );

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.delete("/books/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await booksCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post("/cart", async (req, res) => {
      try {
        const { email, book } = req.body;

        if (!email || !book) {
          return res.status(400).send({
            success: false,
            message: "Email and Book ID are required.",
          });
        }

        const userCart = await cartCollection.findOne({ email });

        if (!userCart) {
          const result = await cartCollection.insertOne({
            email,
            book: [book],
            createdAt: new Date(),
          });

          return res.send({
            success: true,
            insertedId: result.insertedId,
            message: "Book added to cart.",
          });
        }

        const books = Array.isArray(userCart.book) ? userCart.book : [];

        if (books.includes(book)) {
          return res.send({
            success: false,
            alreadyExists: true,
            message: "Book already exists in cart.",
          });
        }
        await cartCollection.updateOne(
          { email },
          {
            $push: {
              book: book,
            },
          }
        );

        return res.send({
          success: true,
          message: "Book added successfully.",
        });
      } catch (error) {
        console.log(error);
        return res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });
      }
    });

    app.get("/cart/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const cart = await cartCollection.findOne({ email });

        if (!cart) {
          return res.send([]);
        }

        const ids = cart.book.map(id => new ObjectId(id));

        const books = await booksCollection.find({
          _id: { $in: ids },
        }).toArray();

        const finalBooks = books.map(book => ({
          ...book,
          quantity: 1,
        }));

        res.send(finalBooks);
      } catch (err) {
        console.log(err);
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    app.delete("/cart/:email/:bookId", async (req, res) => {
      try {
        const { email, bookId } = req.params;

        await cartCollection.updateOne(
          { email },
          {
            $pull: {
              book: bookId,
            },
          }
        );

        res.send({
          success: true,
          message: "Removed Successfully",
        });
      } catch (err) {
        console.log(err);
        res.status(500).send({
          success: false,
          message: err.message,
        });
      }
    });

    /* ========================= NEWS ========================= */

    app.get("/news", async (req, res) => {
      try {
        const news = await newsCollection.find().toArray();
        res.send(news);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post("/news", async (req, res) => {
      try {
        const news = req.body;

        const result = await newsCollection.insertOne({
          title: news.title,
          description: news.description,
          date: news.date,
          image: news.image,
          public_id: news.public_id,
          status: news.status,
          created_at: new Date(),
        });

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.put("/news/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        const result = await newsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              title: updateData.title,
              description: updateData.description,
              date: updateData.date,
              image: updateData.image,
              public_id: updateData.public_id,
              status: updateData.status,
            },
          }
        );

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    /* ========================= EVENTS ========================= */

    app.get("/events", async (req, res) => {
      try {
        const events = await eventsCollection.find().toArray();
        res.send(events);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post("/event", async (req, res) => {
      try {
        const event = req.body;

        const result = await eventsCollection.insertOne({
          title: event.title,
          description: event.description,
          date: event.date,
          start_time: event.start_time,
          end_time: event.end_time,
          available_seats: event.available_seats,
          image: event.image,
          created_at: event.created_at,
        });

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.put("/events/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const event = req.body;

        const result = await eventsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              title: event.title,
              description: event.description,
              date: event.date,
              start_time: event.start_time,
              end_time: event.end_time,
              available_seats: event.available_seats,
              image: event.image,
            },
          }
        );

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });


    app.delete("/events/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await eventsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: "Event not found",
          });
        }

        res.status(200).send({
          success: true,
          message: "Event deleted successfully",
        });

      } catch (error) {
        console.error("Delete event error:", error);

        res.status(500).send({
          success: false,
          message: "Failed to delete event",
          error: error.message,
        });
      }
    });

    /* ========================= EVENT JOIN ========================= */

    app.get("/event/join", async (req, res) => {
      try {
        const events = await eventJoinCollection.find().toArray();
        res.send(events);
      } catch (error) {
        sendError(res, error);
      }
    });
    app.post("/event/join", async (req, res) => {
      const session = client.startSession();

      try {
        const joinInfo = req.body;

        await session.withTransaction(async () => {

          const alreadyJoined = await eventJoinCollection.findOne(
            {
              event_id: joinInfo.event_id,
              user_email: joinInfo.user_email,
            },
            { session }
          );

          if (alreadyJoined) {
            throw new Error("ALREADY_JOINED");
          }

          const event = await eventsCollection.findOne(
            { _id: new ObjectId(joinInfo.event_id) },
            { session }
          );

          if (!event) {
            throw new Error("EVENT_NOT_FOUND");
          }

          if (event.available_seats <= 0) {
            throw new Error("HOUSEFULL");
          }

          await eventJoinCollection.insertOne(joinInfo, { session });

          await eventsCollection.updateOne(
            { _id: new ObjectId(joinInfo.event_id) },
            {
              $inc: {
                available_seats: -1,
              },
            },
            { session }
          );
        });

        await session.endSession();

        return res.send({
          insertedId: true,
        });

      } catch (error) {

        await session.endSession();

        if (error.message === "ALREADY_JOINED") {
          return res.send({
            message: "You already joined this event.",
          });
        }

        if (error.message === "HOUSEFULL") {
          return res.send({
            message: "This event is housefull.",
          });
        }

        if (error.message === "EVENT_NOT_FOUND") {
          return res.status(404).send({
            success: false,
            message: "Event not found.",
          });
        }

        return sendError(res, error);
      }
    });

    /* ========================= MEMBERS ========================= */

    app.get("/members", async (req, res) => {
      try {
        const members = await membersCollection.find().toArray();
        res.send(members);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post("/members", async (req, res) => {
      try {
        const member = req.body;

        const result = await membersCollection.insertOne(member);

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.delete("/members/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await membersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    /* ========================= USERS ========================= */

    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.get("/users/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const result = await usersCollection.find({
          email,
        }).toArray();

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;

        const alreadyExist = await usersCollection.findOne({
          email: user.email,
        });

        if (alreadyExist) {
          return res.send({
            message: "User already exists",
          });
        }

        const result = await usersCollection.insertOne(user);

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.patch("/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const update = req.body;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: update,
          }
        );

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });
    app.delete("/users/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    /* ========================= USER RESPONSES ========================= */

    app.get("/responses", async (req, res) => {
      try {
        const result = await usersResponsesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post("/responses", async (req, res) => {
      try {
        const response = req.body;

        const result = await usersResponsesCollection.insertOne(response);

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    app.delete("/responses/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await usersResponsesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        sendError(res, error);
      }
    });

    // ======================== Change User Role =============================

    app.patch("/users/role/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const { type } = req.body;
        if (!email || !type) {
          return res.status(400).send({
            success: false,
            message: "Email and role are required."
          });
        }
        const filter = {
          email: email
        };
        const updateDoc = {
          $set: {
            type: type
          }
        };
        const result = await usersCollection.updateOne(
          filter,
          updateDoc
        );
        if (result.matchedCount === 0) {

          return res.status(404).send({
            success: false,
            message: "User not found."
          });
        }
        res.send({
          success: true,
          message: "Role updated successfully.",
          modifiedCount: result.modifiedCount
        });
      }
      catch (error) {
        res.status(500).send({
          success: false,
          message: "Internal Server Error"
        });
      }
    });

    /* ========================= Message ========================= */
    app.patch("/users/message/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const message = req.body;

        const user = await usersCollection.findOne(
          { _id: new ObjectId(id) },
          { projection: { messages: 1 } }
        );

        let messages = user?.messages || [];

        if (messages.length >= 10) {
          messages.shift();
        }

        messages.push(message);

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              messages,
            },
          }
        );

        res.send(result);

      }
      catch (error) {
        handleServerError(res, error);
      }
    });

    /* ========================= Converstaions ========================= */
    // app.get("/conversations/user/:email", async (req, res) => {
    //   try {
    //     const { email } = req.params;

    //     const conversations = await conversationsCollection
    //       .find({
    //         "user.email": email,
    //       })
    //       .sort({
    //         lastMessageAt: -1,
    //       })
    //       .toArray();

    //     res.send(conversations);
    //   } catch (error) {
    //     handleServerError(res, error);
    //   }
    // });

    // app.get("/conversations", async (req, res) => {
    //   try {
    //     const result = await conversationsCollection
    //       .find()
    //       .sort({ updatedAt: -1 })
    //       .toArray();
    //     res.send(result);
    //   }
    //   catch (error) {
    //     handleServerError(res, error);
    //   }
    // });

    // app.post("/conversations/contact", async (req, res) => {
    //   try {
    //     const {
    //       name,
    //       email,
    //       subject,
    //       message,
    //       createdAt,
    //     } = req.body;

    //     if (!name || !email || !message) {
    //       return res.status(400).send({
    //         success: false,
    //         message: "Name, email and message are required",
    //       });
    //     }

    //     const existingConversation = await conversationsCollection.findOne({
    //       "user.email": email,
    //     });

    //     const messageData = {
    //       text: message.trim(),
    //       subject: subject?.trim() || "",
    //       sender: "user",
    //       sender_email: email,
    //       sentAt: createdAt || new Date().toISOString(),
    //     };

    //     if (existingConversation) {
    //       const messages = [
    //         ...(existingConversation.messages || []),
    //         messageData,
    //       ].slice(-10);

    //       const result = await conversationsCollection.updateOne(
    //         { _id: existingConversation._id },
    //         {
    //           $set: {
    //             messages,
    //             lastMessage: message.trim(),
    //             lastMessageAt: messageData.sentAt,
    //             unreadForAdmin:
    //               (existingConversation.unreadForAdmin || 0) + 1,
    //           },
    //         }
    //       );

    //       return res.send({
    //         success: true,
    //         inserted: false,
    //         result,
    //       });
    //     }

    //     const conversationData = {
    //       user: {
    //         name,
    //         email,
    //       },
    //       messages: [messageData],
    //       lastMessage: message.trim(),
    //       lastMessageAt: messageData.sentAt,
    //       unreadForAdmin: 1,
    //       unreadForUser: 0,
    //       createdAt: messageData.sentAt,
    //     };

    //     const result = await conversationsCollection.insertOne(
    //       conversationData
    //     );

    //     res.send({
    //       success: true,
    //       inserted: true,
    //       insertedId: result.insertedId,
    //     });
    //   } catch (error) {
    //     handleServerError(res, error);
    //   }
    // });

    // app.patch("/conversations/:id/message", async (req, res) => {
    //   try {
    //     const { id } = req.params;
    //     const message = req.body;

    //     if (!message?.text?.trim()) {
    //       return res.status(400).send({
    //         success: false,
    //         message: "Message text is required",
    //       });
    //     }

    //     const conversation = await conversationsCollection.findOne({
    //       _id: new ObjectId(id),
    //     });

    //     if (!conversation) {
    //       return res.status(404).send({
    //         success: false,
    //         message: "Conversation not found",
    //       });
    //     }

    //     const messages = [
    //       ...(conversation.messages || []),
    //       {
    //         ...message,
    //         text: message.text.trim(),
    //         sentAt: message.sentAt || new Date().toISOString(),
    //       },
    //     ].slice(-10);

    //     const isAdmin = message.sender === "admin";

    //     const result = await conversationsCollection.updateOne(
    //       { _id: new ObjectId(id) },
    //       {
    //         $set: {
    //           messages,
    //           lastMessage: message.text.trim(),
    //           lastMessageAt: message.sentAt || new Date().toISOString(),
    //           ...(isAdmin
    //             ? {
    //               unreadForUser:
    //                 (conversation.unreadForUser || 0) + 1,
    //             }
    //             : {
    //               unreadForAdmin:
    //                 (conversation.unreadForAdmin || 0) + 1,
    //             }),
    //         },
    //       }
    //     );

    //     res.send({
    //       success: true,
    //       result,
    //     });
    //   } catch (error) {
    //     handleServerError(res, error);
    //   }
    // });

    // app.patch("/conversations/:id/read", async (req, res) => {
    //   try {
    //     const { id } = req.params;
    //     const { reader } = req.body;

    //     if (!["user", "admin"].includes(reader)) {
    //       return res.status(400).send({
    //         success: false,
    //         message: "Invalid reader",
    //       });
    //     }

    //     const updateField =
    //       reader === "user"
    //         ? { unreadForUser: 0 }
    //         : { unreadForAdmin: 0 };

    //     const result = await conversationsCollection.updateOne(
    //       { _id: new ObjectId(id) },
    //       {
    //         $set: updateField,
    //       }
    //     );

    //     res.send({
    //       success: true,
    //       result,
    //     });
    //   } catch (error) {
    //     handleServerError(res, error);
    //   }
    // });

    // app.post("/conversations/start", async (req, res) => {
    //   try {
    //     const { user_id, user_name, user_email, user_image, message, admin_email } = req.body;

    //     if (!user_email || !message?.trim()) {
    //       return res.status(400).send({
    //         success: false,
    //         message: "User email and message are required",
    //       });
    //     }

    //     const existingConversation = await conversationsCollection.findOne({
    //       "user.email": user_email,
    //     });

    //     const messageData = {
    //       text: message.trim(),
    //       sender: "admin",
    //       sender_email: admin_email,
    //       sentAt: new Date().toISOString(),
    //     };

    //     if (existingConversation) {
    //       const result = await conversationsCollection.updateOne(
    //         { _id: existingConversation._id },
    //         {
    //           $push: {
    //             messages: messageData,
    //           },
    //           $set: {
    //             lastMessage: message.trim(),
    //             lastMessageAt: messageData.sentAt,
    //             unreadForUser: (existingConversation.unreadForUser || 0) + 1,
    //           },
    //         }
    //       );

    //       return res.send({
    //         success: true,
    //         inserted: false,
    //         result,
    //       });
    //     }

    //     const conversation = {
    //       user: {
    //         id: user_id,
    //         name: user_name,
    //         email: user_email,
    //         image: user_image,
    //       },
    //       messages: [messageData],
    //       lastMessage: message.trim(),
    //       lastMessageAt: messageData.sentAt,
    //       unreadForAdmin: 0,
    //       unreadForUser: 1,
    //       createdAt: new Date().toISOString(),
    //     };

    //     const result = await conversationsCollection.insertOne(
    //       conversation
    //     );

    //     res.send({
    //       success: true,
    //       inserted: true,
    //       insertedId: result.insertedId,
    //     });
    //   } catch (error) {
    //     handleServerError(res, error);
    //   }
    // });

    // ======================= Support  Conversations ==============================

    // app.patch("/conversations/:id/message", async (req, res) => {
    //   try {
    //     const { id } = req.params;
    //     const { text, senderId } = req.body;

    //     if (!text || !senderId) {
    //       return res.status(400).send({
    //         success: false,
    //         message: "Text and senderId are required",
    //       });
    //     }

    //     const conversation = await conversationsCollection.findOne({
    //       _id: new ObjectId(id),
    //     });

    //     if (!conversation) {
    //       return res.status(404).send({
    //         success: false,
    //         message: "Conversation not found",
    //       });
    //     }

    //     const isUser = String(senderId) === String(conversation.userId);

    //     const message = {
    //       text,
    //       senderId,
    //       sentAt: new Date().toISOString(),
    //     };

    //     const update = {
    //       $push: {
    //         messages: message,
    //       },
    //       $set: {
    //         lastMessage: text,
    //         lastMessageAt: message.sentAt,
    //       },
    //     };

    //     if (isUser) {
    //       update.$inc = {
    //         unreadForAdmin: 1,
    //       };
    //     } else {
    //       update.$inc = {
    //         unreadForUser: 1,
    //       };
    //     }

    //     const result =
    //       await conversationsCollection.updateOne(
    //         {
    //           _id: new ObjectId(id),
    //         },
    //         update
    //       );

    //     res.send({
    //       success: result.modifiedCount > 0,
    //     });
    //   } catch (error) {
    //     handleServerError(res, error);
    //   }
    // });

    app.patch(
      "/conversations/support/:userEmail/read",
      async (req, res) => {
        try {
          const { userEmail } = req.params;

          const {
            readerEmail,
          } = req.body;

          if (!userEmail || !readerEmail) {
            return res.status(400).send({
              success: false,
              message:
                "User email and reader email are required",
            });
          }

          const result =
            await conversationsCollection.updateOne(
              {
                type: "support",

                status: "active",

                participantIds:
                  userEmail,
              },

              {
                $set: {
                  [`unreadCount.${readerEmail}`]: 0,
                },
              }
            );

          res.send({
            success: true,
            result,
          });
        } catch (error) {
          console.error(
            "Support read error:",
            error
          );

          handleServerError(res, error);
        }
      }
    );

    app.post("/conversations/support", async (req, res) => {
      try {
        const {
          userId,
          name,
          email,
          image,
          message,
        } = req.body;

        // ============================================
        // Validate user information
        // ============================================

        if (!userId || !email || !message?.trim()) {
          return res.status(400).send({
            success: false,
            message:
              "User ID, email and message are required",
          });
        }

        if (!ObjectId.isValid(userId)) {
          return res.status(400).send({
            success: false,
            message: "Invalid user ID",
          });
        }

        // ============================================
        // Find user
        // ============================================

        const user = await usersCollection.findOne({
          _id: new ObjectId(userId),
          email,
        });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        // ============================================
        // Find admin
        // ============================================

        const admin = await usersCollection.findOne({
          type: "admin",
        });

        if (!admin) {
          return res.status(404).send({
            success: false,
            message: "Admin not found",
          });
        }

        const userIdString = user._id.toString();
        const adminIdString = admin._id.toString();

        // ============================================
        // Find existing active support conversation
        // ============================================

        const existingConversation =
          await conversationsCollection.findOne({
            type: "support",
            status: "active",
            participantIds: {
              $all: [
                userIdString,
                adminIdString,
              ],
            },
          });

        // ============================================
        // Message
        // ============================================

        const sentAt = new Date().toISOString();

        const messageData = {
          _id: new ObjectId(),
          text: message.trim(),
          senderId: userIdString,
          senderEmail: user.email,
          sender: "user",
          sentAt,
        };

        // ============================================
        // Existing Conversation
        // ============================================

        if (existingConversation) {
          const result =
            await conversationsCollection.updateOne(
              {
                _id: existingConversation._id,
              },
              {
                $push: {
                  messages: messageData,
                },

                $set: {
                  lastMessage:
                    messageData.text,

                  lastMessageAt:
                    sentAt,

                  updatedAt:
                    sentAt,
                },

                // Message sender is user.
                // Therefore admin unread increases.
                $inc: {
                  [`unread.${adminIdString}`]: 1,
                },
              }
            );

          const updatedConversation =
            await conversationsCollection.findOne({
              _id: existingConversation._id,
            });

          return res.send({
            success: true,
            inserted: false,
            conversationId:
              existingConversation._id,
            conversation:
              updatedConversation,
            result,
          });
        }

        // ============================================
        // Create New Conversation
        // ============================================

        const conversation = {
          type: "support",

          participantIds: [
            userIdString,
            adminIdString,
          ],

          status: "active",

          messages: [
            messageData,
          ],

          lastMessage:
            messageData.text,

          lastMessageAt:
            sentAt,

          unread: {
            [userIdString]: 0,
            [adminIdString]: 1,
          },

          blockedBy: [],

          users: [
            {
              _id: userIdString,

              name:
                name ||
                `${user.first_name || ""} ${user.last_name || ""
                  }`.trim(),

              email: user.email,

              image:
                image ||
                user.image ||
                "",
            },

            {
              _id: adminIdString,

              name:
                `${admin.first_name || ""} ${admin.last_name || ""
                  }`.trim() ||
                "Administration",

              email: admin.email,

              image:
                admin.image || "",
            },
          ],

          createdAt: sentAt,

          updatedAt: sentAt,
        };

        const result =
          await conversationsCollection.insertOne(
            conversation
          );

        const createdConversation =
          await conversationsCollection.findOne({
            _id: result.insertedId,
          });

        res.send({
          success: true,
          inserted: true,
          insertedId: result.insertedId,
          conversation:
            createdConversation,
        });
      } catch (error) {
        console.error(
          "Create support conversation error:",
          error
        );

        handleServerError(res, error);
      }
    });


    app.get(
      "/conversations/support/:userId",
      async (req, res) => {
        try {
          const { userId } = req.params;

          if (!userId) {
            return res.status(400).send({
              success: false,
              message:
                "User email is required",
            });
          }

          const conversation =
            await conversationsCollection.findOne({
              type: "support",

              status: "active",

              participantIds: userId,
            });

          res.send({
            success: true,

            conversation:
              conversation || null,
          });
        } catch (error) {
          console.error(
            "Support conversation error:",
            error
          );

          handleServerError(res, error);
        }
      }
    );


    app.patch(
      "/conversations/support/:conversationId/message",
      async (req, res) => {
        try {
          const { conversationId } = req.params;

          const {
            senderId,
            text,
          } = req.body;

          // ============================================
          // Validate
          // ============================================

          if (!conversationId) {
            return res.status(400).send({
              success: false,
              message:
                "Conversation ID is required",
            });
          }

          if (!ObjectId.isValid(conversationId)) {
            return res.status(400).send({
              success: false,
              message:
                "Invalid conversation ID",
            });
          }

          if (!senderId || !text?.trim()) {
            return res.status(400).send({
              success: false,
              message:
                "Sender ID and message are required",
            });
          }

          if (!ObjectId.isValid(senderId)) {
            return res.status(400).send({
              success: false,
              message:
                "Invalid sender ID",
            });
          }

          // ============================================
          // Find sender
          // ============================================

          const sender =
            await usersCollection.findOne({
              _id: new ObjectId(senderId),
            });

          if (!sender) {
            return res.status(404).send({
              success: false,
              message:
                "Sender not found",
            });
          }

          const senderIdString =
            sender._id.toString();

          // ============================================
          // Find active support conversation
          // ============================================

          const conversation =
            await conversationsCollection.findOne({
              _id: new ObjectId(conversationId),

              type: "support",

              status: "active",

              participantIds:
                senderIdString,
            });

          if (!conversation) {
            return res.status(404).send({
              success: false,
              message:
                "Active support conversation not found",
            });
          }

          // ============================================
          // Block check
          // ============================================

          if (
            Array.isArray(
              conversation.blockedBy
            ) &&
            conversation.blockedBy.length > 0
          ) {
            return res.status(403).send({
              success: false,
              message:
                "You cannot send messages in this conversation",
            });
          }

          // ============================================
          // Find other participant
          // ============================================

          const otherUserId =
            conversation.participantIds.find(
              id =>
                id.toString() !==
                senderIdString
            );

          if (!otherUserId) {
            return res.status(400).send({
              success: false,
              message:
                "Other participant not found",
            });
          }

          // ============================================
          // Create message
          // ============================================

          const now =
            new Date().toISOString();

          const messageData = {
            _id: new ObjectId(),

            text: text.trim(),

            senderId:
              senderIdString,

            senderEmail:
              sender.email,

            sender: "user",

            sentAt: now,
          };

          // ============================================
          // Save message
          // + increase receiver unread
          // ============================================

          await conversationsCollection.updateOne(
            {
              _id: conversation._id,
            },
            {
              $push: {
                messages:
                  messageData,
              },

              $set: {
                lastMessage:
                  messageData.text,

                lastMessageAt:
                  now,

                updatedAt:
                  now,
              },

              $inc: {
                [`unread.${otherUserId}`]: 1,
              },
            }
          );

          // ============================================
          // Get updated conversation
          // ============================================

          const updatedConversation =
            await conversationsCollection.findOne({
              _id: conversation._id,
            });

          res.send({
            success: true,

            conversation:
              updatedConversation,

            message:
              messageData,
          });
        } catch (error) {
          console.error(
            "Send support message error:",
            error
          );

          handleServerError(res, error);
        }
      }
    );

    app.get("/conversations/support/unread/admin", async (req, res) => {
      try {
        const admin = await usersCollection.findOne({
          type: "admin",
        });

        if (!admin) {
          return res.status(404).send({
            success: false,
            message: "Admin not found",
          });
        }

        const adminId = admin._id.toString();

        const conversations = await conversationsCollection
          .find({
            type: "support",
            status: "active",
            [`unreadCount.${adminId}`]: {
              $gt: 0,
            },
          })
          .toArray();

        const unreadCount = conversations.reduce(
          (total, conversation) =>
            total +
            (conversation.unreadCount?.[adminId] || 0),
          0
        );

        res.send({
          success: true,
          unreadCount,
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });

    app.get(
      "/conversations/support/unread/:userEmail",
      async (req, res) => {
        try {
          const { userEmail } = req.params;

          if (!userEmail) {
            return res.status(400).send({
              success: false,
              message: "User email is required",
            });
          }

          const conversation =
            await conversationsCollection.findOne({
              type: "support",
              status: "active",
              participantIds: {
                $in: [userEmail],
              },
            });

          if (!conversation) {
            return res.send({
              success: true,
              unreadCount: 0,
            });
          }

          const unreadCount =
            conversation.unreadCount?.[userEmail] || 0;

          res.send({
            success: true,
            unreadCount,
          });
        } catch (error) {
          handleServerError(res, error);
        }
      }
    );

    // app.get("/conversations/support", async (req, res) => {
    //   try {
    //     const conversations = await conversationsCollection
    //       .find({
    //         type: "support",
    //         status: "active",
    //       })
    //       .sort({
    //         lastMessageAt: -1,
    //       })
    //       .toArray();

    //     res.send({
    //       success: true,
    //       conversations,
    //     });
    //   } catch (error) {
    //     handleServerError(res, error);
    //   }
    // });

    app.get("/conversations/support", async (req, res) => {
      try {
        // ============================================
        // Find admin
        // ============================================

        const admin = await usersCollection.findOne({
          type: "admin",
        });

        if (!admin) {
          return res.status(404).send({
            success: false,
            message: "Admin not found",
          });
        }

        const adminId = admin._id.toString();

        // ============================================
        // Get active support conversations
        // ============================================

        const conversations =
          await conversationsCollection
            .find({
              type: "support",
              status: "active",
            })
            .sort({
              lastMessageAt: -1,
            })
            .toArray();

        // ============================================
        // Attach user information
        // ============================================

        const updatedConversations =
          await Promise.all(
            conversations.map(async conversation => {

              // Find user ID
              const userId =
                conversation.participantIds?.find(
                  id =>
                    id.toString() !==
                    adminId
                );

              if (!userId) {
                return {
                  ...conversation,
                  user: null,
                };
              }

              // Find user from users collection
              const user =
                await usersCollection.findOne({
                  _id: new ObjectId(
                    userId
                  ),
                });

              return {
                ...conversation,

                user: user
                  ? {
                    _id: user._id.toString(),

                    name:
                      `${user.first_name || ""} ${user.last_name || ""}`
                        .trim() ||
                      "Unknown User",

                    email:
                      user.email || "",

                    image:
                      user.image || "",
                  }
                  : null,
              };
            })
          );

        // ============================================
        // Response
        // ============================================

        res.send({
          success: true,
          conversations:
            updatedConversations,
        });

      } catch (error) {
        console.error(
          "Get support conversations error:",
          error
        );

        handleServerError(res, error);
      }
    });


    app.delete("/conversations/:id/end", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await conversationsCollection.deleteOne({
          _id: new ObjectId(id),
          type: "support",
        });

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });


    // ========================= Message Request ==============================

    app.post("/conversations/private/request", async (req, res) => {
      try {
        const {
          requesterId,
          receiverId,
          message,
        } = req.body;

        if (!requesterId || !receiverId || !message?.trim()) {
          return res.status(400).send({
            success: false,
            message: "Requester, receiver and message are required",
          });
        }

        if (requesterId === receiverId) {
          return res.status(400).send({
            success: false,
            message: "You cannot message yourself",
          });
        }

        const requester = await usersCollection.findOne({
          _id: new ObjectId(requesterId),
        });

        const receiver = await usersCollection.findOne({
          _id: new ObjectId(receiverId),
        });

        if (!requester || !receiver) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        const existingConversation =
          await conversationsCollection.findOne({
            $or: [
              {
                "participants.0": requesterId,
                "participants.1": receiverId,
              },
              {
                "participants.0": receiverId,
                "participants.1": requesterId,
              },
            ],
          });

        if (existingConversation?.blockedBy?.length) {
          return res.status(403).send({
            success: false,
            message: "This conversation is blocked",
          });
        }

        if (existingConversation) {
          const newMessage = {
            text: message.trim(),
            senderId: requesterId,
            sentAt: new Date().toISOString(),
          };

          const result =
            await conversationsCollection.updateOne(
              {
                _id: existingConversation._id,
              },
              {
                $push: {
                  messages: newMessage,
                },
                $set: {
                  lastMessage: message.trim(),
                  lastMessageAt:
                    newMessage.sentAt,
                  status:
                    requester.type === "admin"
                      ? "active"
                      : existingConversation.status,
                },
                $inc: {
                  [requesterId ===
                    existingConversation.participants[0]
                    ? "unreadForSecond"
                    : "unreadForFirst"]: 1,
                },
              }
            );

          return res.send({
            success: true,
            message: "Message sent",
            result,
          });
        }

        const isAdmin = requester.type === "admin";

        const createdAt = new Date().toISOString();

        const conversation = {
          participants: [
            requesterId,
            receiverId,
          ],

          users: {
            [requesterId]: {
              name: `${requester.first_name || ""} ${requester.last_name || ""}`.trim(),
              email: requester.email,
              image: requester.image || "",
              type: requester.type,
            },

            [receiverId]: {
              name: `${receiver.first_name || ""} ${receiver.last_name || ""}`.trim(),
              email: receiver.email,
              image: receiver.image || "",
              type: receiver.type,
            },
          },

          messages: [
            {
              text: message.trim(),
              senderId: requesterId,
              sentAt: createdAt,
            },
          ],

          status: isAdmin ? "active" : "pending",

          requestedBy: isAdmin
            ? null
            : requesterId,

          blockedBy: [],

          lastMessage: message.trim(),

          lastMessageAt: createdAt,

          unreadForFirst: 0,

          unreadForSecond: 1,

          createdAt,
        };

        const result =
          await conversationsCollection.insertOne(
            conversation
          );

        res.send({
          success: true,
          message: isAdmin
            ? "Conversation started successfully"
            : "Message request sent successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });

    // ============================= Private Converstaion ============================

    app.get(
      "/conversations/private/:userId/:targetUserId",
      async (req, res) => {
        try {
          const {
            userId,
            targetUserId,
          } = req.params;

          if (!userId || !targetUserId) {
            return res.status(400).send({
              success: false,
              message: "User IDs are required",
            });
          }

          const conversation =
            await conversationsCollection.findOne({
              participants: {
                $all: [
                  userId,
                  targetUserId,
                ],
              },
            });

          if (!conversation) {
            return res.send({
              success: true,
              conversation: null,
            });
          }

          res.send({
            success: true,
            conversation,
          });
        } catch (error) {
          handleServerError(res, error);
        }
      }
    );


    // ======================== Read / Block / Unblock ==============================

    app.patch(
      "/conversations/:id/block",
      async (req, res) => {
        try {
          const { id } = req.params;
          const { userId } = req.body;

          if (!userId) {
            return res.status(400).send({
              success: false,
              message: "User ID is required",
            });
          }

          const conversation =
            await conversationsCollection.findOne({
              _id: new ObjectId(id),
            });

          if (!conversation) {
            return res.status(404).send({
              success: false,
              message: "Conversation not found",
            });
          }

          if (!conversation.participants?.includes(userId)) {
            return res.status(403).send({
              success: false,
              message: "You are not part of this conversation",
            });
          }

          const result =
            await conversationsCollection.updateOne(
              {
                _id: new ObjectId(id),
              },
              {
                $addToSet: {
                  blockedBy: userId,
                },
                $set: {
                  updatedAt: new Date().toISOString(),
                },
              }
            );

          res.send({
            success: true,
            message: "User blocked successfully",
            result,
          });
        } catch (error) {
          handleServerError(res, error);
        }
      }
    );

    app.patch(
      "/conversations/:id/unblock",
      async (req, res) => {
        try {
          const { id } = req.params;
          const { userId } = req.body;

          if (!userId) {
            return res.status(400).send({
              success: false,
              message: "User ID is required",
            });
          }

          const conversation =
            await conversationsCollection.findOne({
              _id: new ObjectId(id),
            });

          if (!conversation) {
            return res.status(404).send({
              success: false,
              message: "Conversation not found",
            });
          }

          if (!conversation.participants?.includes(userId)) {
            return res.status(403).send({
              success: false,
              message: "You are not part of this conversation",
            });
          }

          const result =
            await conversationsCollection.updateOne(
              {
                _id: new ObjectId(id),
              },
              {
                $pull: {
                  blockedBy: userId,
                },
                $set: {
                  updatedAt: new Date().toISOString(),
                },
              }
            );

          res.send({
            success: true,
            message: "User unblocked successfully",
            result,
          });
        } catch (error) {
          handleServerError(res, error);
        }
      }
    );

    app.get("/users/message-members/:email", async (req, res) => {
      try {
        const { email } = req.params;

        if (!email) {
          return res.status(400).send({
            success: false,
            message: "User email is required",
          });
        }

        // Current logged-in user
        const currentUser = await usersCollection.findOne({
          email,
        });

        if (!currentUser) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        // সব user থেকে current user এবং admin বাদ
        const members = await usersCollection
          .find({
            _id: {
              $ne: currentUser._id,
            },
            type: {
              $ne: "admin",
            },
          })
          .project({
            first_name: 1,
            last_name: 1,
            name: 1,
            email: 1,
            image: 1,
            type: 1,
          })
          .toArray();

        res.send({
          success: true,
          members,
        });
      } catch (error) {
        console.error(
          "Message members error:",
          error
        );

        handleServerError(res, error);
      }
    });

    // ========================== Get User Conversation ===========================

    app.get(
      "/conversations/user/:userId",
      async (req, res) => {
        try {
          const { userId } = req.params;

          if (!userId) {
            return res.status(400).send({
              success: false,
              message:
                "User ID is required",
            });
          }

          const conversations =
            await conversationsCollection
              .find({
                type: "user",
                status: "active",
                participantIds: {
                  $in: [
                    userId.toString(),
                  ],
                },
              })
              .sort({
                updatedAt: -1,
              })
              .toArray();

          res.send({
            success: true,
            conversations,
          });
        } catch (error) {
          console.error(
            "Fetch user conversations error:",
            error
          );

          handleServerError(res, error);
        }
      }
    );

    // ============================= Get Members List ==============================

    app.get("/users/message-members/:userEmail", async (req, res) => {
      try {
        const { userEmail } = req.params;

        if (!userEmail) {
          return res.status(400).send({
            success: false,
            message: "User email is required",
          });
        }

        // Current MongoDB user
        const currentUser = await usersCollection.findOne({
          email: userEmail,
        });

        if (!currentUser) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        // Admin can see everyone except himself.
        // Normal member/volunteer can see only
        // member + volunteer.
        const filter =
          currentUser.type === "admin"
            ? {
              _id: {
                $ne: currentUser._id,
              },
            }
            : {
              _id: {
                $ne: currentUser._id,
              },
              type: {
                $in: ["member", "volunteer"],
              },
            };

        const users = await usersCollection
          .find(filter)
          .project({
            first_name: 1,
            last_name: 1,
            email: 1,
            image: 1,
            type: 1,
          })
          .toArray();

        const members = users.map(item => ({
          _id: item._id,
          name: `${item.first_name || ""} ${item.last_name || ""
            }`.trim(),
          email: item.email,
          image: item.image || "",
          type: item.type,
        }));

        res.send({
          success: true,
          members,
        });

      } catch (error) {
        console.error(
          "Message members error:",
          error
        );

        handleServerError(res, error);
      }
    });


    // ============================== Accept Message Request =============================

    app.patch("/conversations/:id/accept", async (req, res) => {
      try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
          return res.status(400).send({
            success: false,
            message: "User ID is required",
          });
        }

        const conversation = await conversationsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!conversation) {
          return res.status(404).send({
            success: false,
            message: "Conversation not found",
          });
        }

        if (!conversation.participants?.includes(userId)) {
          return res.status(403).send({
            success: false,
            message: "You are not part of this conversation",
          });
        }

        if (conversation.status !== "pending") {
          return res.send({
            success: true,
            message: "Conversation is already active",
          });
        }

        if (conversation.requestedBy === userId) {
          return res.status(403).send({
            success: false,
            message: "The requester cannot accept their own request",
          });
        }

        const result = await conversationsCollection.updateOne(
          {
            _id: new ObjectId(id),
            status: "pending",
          },
          {
            $set: {
              status: "active",
              acceptedBy: userId,
              acceptedAt: new Date().toISOString(),
            },
          }
        );

        res.send({
          success: true,
          message: "Message request accepted",
          result,
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });

    //  ============================= Converstaions Api =================================

    app.get("/conversations/user/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        const conversations = await conversationsCollection
          .find({
            participants: userId,
            ended: { $ne: true },
          })
          .sort({ lastMessageAt: -1 })
          .toArray();

        res.send({
          success: true,
          conversations,
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });

    app.get(
      "/conversations/private/:userId/:otherUserId",
      async (req, res) => {
        try {
          const { userId, otherUserId } = req.params;

          const conversation =
            await conversationsCollection.findOne({
              participants: {
                $all: [userId, otherUserId],
              },
              ended: { $ne: true },
            });

          res.send({
            success: true,
            conversation: conversation || null,
          });
        } catch (error) {
          handleServerError(res, error);
        }
      }
    );


    app.patch("/conversations/:id/block", async (req, res) => {
      try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
          return res.status(400).send({
            success: false,
            message: "User ID is required",
          });
        }

        const result =
          await conversationsCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $addToSet: {
                blockedBy: userId,
              },
            }
          );

        res.send({
          success: result.modifiedCount > 0,
          message: "User blocked successfully",
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });

    app.patch("/conversations/:id/unblock", async (req, res) => {
      try {
        const { id } = req.params;
        const { userId } = req.body;

        const result =
          await conversationsCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $pull: {
                blockedBy: userId,
              },
            }
          );

        res.send({
          success: result.modifiedCount > 0,
          message: "User unblocked successfully",
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });

    app.delete("/conversations/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result =
          await conversationsCollection.deleteOne({
            _id: new ObjectId(id),
          });

        res.send({
          success: result.deletedCount > 0,
          message: "Conversation ended successfully",
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });

    // ======================== Message Request APIs ==================================

    app.get("/members", async (req, res) => {
      try {
        const { userId } = req.query;

        if (!userId) {
          return res.status(400).send({
            success: false,
            message: "User ID is required",
          });
        }

        const users = await usersCollection
          .find({
            _id: { $ne: new ObjectId(userId) },
            type: { $in: ["member", "volunteer"] },
          })
          .project({
            first_name: 1,
            last_name: 1,
            email: 1,
            image: 1,
            type: 1,
          })
          .toArray();

        const requests =
          await messageRequestsCollection
            .find({
              senderId: userId,
              status: "pending",
            })
            .toArray();

        const requestIds = new Set(
          requests.map(request =>
            request.receiverId.toString()
          )
        );

        const members = users.map(member => ({
          ...member,
          requestSent: requestIds.has(
            member._id.toString()
          ),
        }));

        res.send({
          success: true,
          members,
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });

    app.post("/message-requests", async (req, res) => {
      try {
        const {
          senderId,
          senderEmail,
          receiverId,
          receiverEmail,
        } = req.body;

        if (
          !senderId ||
          !receiverId ||
          !senderEmail ||
          !receiverEmail
        ) {
          return res.status(400).send({
            success: false,
            message:
              "Sender and receiver information are required",
          });
        }

        if (
          senderId.toString() ===
          receiverId.toString()
        ) {
          return res.status(400).send({
            success: false,
            message:
              "You cannot send a message request to yourself",
          });
        }

        // Check sender
        const sender = await usersCollection.findOne({
          _id: new ObjectId(senderId),
          email: senderEmail,
        });

        if (!sender) {
          return res.status(404).send({
            success: false,
            message: "Sender not found",
          });
        }

        // Check receiver
        const receiver = await usersCollection.findOne({
          _id: new ObjectId(receiverId),
          email: receiverEmail,
        });

        if (!receiver) {
          return res.status(404).send({
            success: false,
            message: "Receiver not found",
          });
        }

        // Already active conversation?
        const existingConversation =
          await conversationsCollection.findOne({
            type: "user",
            status: "active",
            participantIds: {
              $all: [
                senderId.toString(),
                receiverId.toString(),
              ],
            },
          });

        if (existingConversation) {
          return res.status(409).send({
            success: false,
            message:
              "A conversation already exists with this user",
          });
        }

        // Existing pending request?
        const existingRequest =
          await messageRequestsCollection.findOne({
            senderId: senderId.toString(),
            receiverId: receiverId.toString(),
            status: "pending",
          });

        if (existingRequest) {
          return res.status(409).send({
            success: false,
            message:
              "Message request already sent",
          });
        }

        const request = {
          senderId: senderId.toString(),
          senderEmail,

          receiverId: receiverId.toString(),
          receiverEmail,

          status: "pending",

          sender: {
            _id: sender._id.toString(),
            name:
              `${sender.first_name || ""} ${sender.last_name || ""
                }`.trim(),
            email: sender.email,
            image: sender.image || "",
          },

          receiver: {
            _id: receiver._id.toString(),
            name:
              `${receiver.first_name || ""} ${receiver.last_name || ""
                }`.trim(),
            email: receiver.email,
            image: receiver.image || "",
          },

          createdAt: new Date().toISOString(),
        };

        const result =
          await messageRequestsCollection.insertOne(
            request
          );

        res.send({
          success: true,
          requestId: result.insertedId,
        });
      } catch (error) {
        console.error(
          "Create message request error:",
          error
        );

        handleServerError(res, error);
      }
    });

    app.get(
      "/message-requests/user/:userId",
      async (req, res) => {
        try {
          const { userId } = req.params;

          if (!userId) {
            return res.status(400).send({
              success: false,
              message:
                "User ID is required",
            });
          }

          const requests =
            await messageRequestsCollection
              .find({
                receiverId:
                  userId.toString(),
                status: "pending",
              })
              .sort({
                createdAt: -1,
              })
              .toArray();

          res.send({
            success: true,
            requests,
          });
        } catch (error) {
          console.error(
            "Fetch message requests error:",
            error
          );

          handleServerError(res, error);
        }
      }
    );

    app.get("/message-requests/:userId", async (req, res) => {
      try {
        const { userId } = req.params;

        if (!userId) {
          return res.status(400).send({
            success: false,
            message: "User ID is required",
          });
        }

        const requests =
          await messageRequestsCollection
            .find({
              receiverId: userId,
              status: "pending",
            })
            .sort({ createdAt: -1 })
            .toArray();

        res.send({
          success: true,
          requests,
        });
      } catch (error) {
        console.error(
          "Fetch message requests error:",
          error
        );

        handleServerError(res, error);
      }
    });

    app.patch(
      "/message-requests/:requestId/accept",
      async (req, res) => {
        try {
          const { requestId } = req.params;

          if (!ObjectId.isValid(requestId)) {
            return res.status(400).send({
              success: false,
              message:
                "Invalid request ID",
            });
          }

          const request =
            await messageRequestsCollection.findOne({
              _id: new ObjectId(requestId),
              status: "pending",
            });

          if (!request) {
            return res.status(404).send({
              success: false,
              message:
                "Message request not found",
            });
          }

          // Check existing conversation
          let conversation =
            await conversationsCollection.findOne({
              type: "user",
              status: "active",
              participantIds: {
                $all: [
                  request.senderId,
                  request.receiverId,
                ],
              },
            });

          // Create conversation if not exists
          if (!conversation) {
            const now =
              new Date().toISOString();

            conversation = {
              type: "user",

              participantIds: [
                request.senderId,
                request.receiverId,
              ],

              status: "active",

              messages: [],

              lastMessage: "",
              lastMessageAt: null,

              unread: {
                [request.senderId]: 0,
                [request.receiverId]: 0,
              },

              blockedBy: [],

              createdAt: now,
              updatedAt: now,

              users: [
                request.sender,
                request.receiver,
              ],
            };

            const result =
              await conversationsCollection.insertOne(
                conversation
              );

            conversation._id =
              result.insertedId;
          }

          // Mark request accepted
          await messageRequestsCollection.updateOne(
            {
              _id: new ObjectId(requestId),
            },
            {
              $set: {
                status: "accepted",
                acceptedAt:
                  new Date().toISOString(),
              },
            }
          );

          res.send({
            success: true,
            conversation,
          });
        } catch (error) {
          console.error(
            "Accept request error:",
            error
          );

          handleServerError(res, error);
        }
      }
    );

    app.patch(
      "/message-requests/:requestId/reject",
      async (req, res) => {
        try {
          const { requestId } = req.params;

          if (!ObjectId.isValid(requestId)) {
            return res.status(400).send({
              success: false,
              message:
                "Invalid request ID",
            });
          }

          const result =
            await messageRequestsCollection.updateOne(
              {
                _id: new ObjectId(requestId),
                status: "pending",
              },
              {
                $set: {
                  status: "rejected",
                  rejectedAt:
                    new Date().toISOString(),
                },
              }
            );

          if (
            result.matchedCount === 0
          ) {
            return res.status(404).send({
              success: false,
              message:
                "Pending request not found",
            });
          }

          res.send({
            success: true,
          });
        } catch (error) {
          console.error(
            "Reject request error:",
            error
          );

          handleServerError(res, error);
        }
      }
    );

    app.patch(
      "/conversations/:conversationId/message",
      async (req, res) => {
        try {
          const { conversationId } = req.params;
          const { senderId, text } = req.body;

          if (!conversationId) {
            return res.status(400).send({
              success: false,
              message: "Conversation ID is required",
            });
          }

          if (!senderId || !text?.trim()) {
            return res.status(400).send({
              success: false,
              message: "Sender and message are required",
            });
          }

          if (!ObjectId.isValid(conversationId)) {
            return res.status(400).send({
              success: false,
              message: "Invalid conversation ID",
            });
          }

          const conversation =
            await conversationsCollection.findOne({
              _id: new ObjectId(conversationId),

              // IMPORTANT:
              // accept API creates type: "user"
              type: "user",

              status: "active",

              participantIds:
                senderId.toString(),
            });

          if (!conversation) {
            return res.status(404).send({
              success: false,
              message: "Active conversation not found",
            });
          }

          // =========================================
          // Block check
          // =========================================

          if (
            Array.isArray(conversation.blockedBy) &&
            conversation.blockedBy.length > 0
          ) {
            return res.status(403).send({
              success: false,
              message:
                "You cannot send messages in this conversation",
            });
          }

          // =========================================
          // Find other participant
          // =========================================

          const otherUserId =
            conversation.participantIds.find(
              id =>
                id.toString() !==
                senderId.toString()
            );

          if (!otherUserId) {
            return res.status(400).send({
              success: false,
              message:
                "Other participant not found",
            });
          }

          // =========================================
          // Create message
          // =========================================

          const now = new Date().toISOString();

          const messageData = {
            _id: new ObjectId(),
            text: text.trim(),
            senderId: senderId.toString(),
            sentAt: now,
          };

          // =========================================
          // Save message + increase receiver unread
          // =========================================

          await conversationsCollection.updateOne(
            {
              _id: conversation._id,
            },
            {
              $push: {
                messages: messageData,
              },

              $set: {
                lastMessage: messageData.text,
                lastMessageAt: now,
                updatedAt: now,
              },

              $inc: {
                [`unread.${otherUserId}`]: 1,
              },
            }
          );

          // =========================================
          // Get updated conversation
          // =========================================

          const updatedConversation =
            await conversationsCollection.findOne({
              _id: conversation._id,
            });

          res.send({
            success: true,
            conversation: updatedConversation,
            message: messageData,
          });
        } catch (error) {
          console.error(
            "Send conversation message error:",
            error
          );

          handleServerError(res, error);
        }
      }
    );

    app.patch(
      "/conversations/:conversationId/read",
      async (req, res) => {
        try {
          const { conversationId } =
            req.params;

          const { userId } = req.body;

          if (!conversationId || !userId) {
            return res.status(400).send({
              success: false,
              message:
                "Conversation and user are required",
            });
          }

          const result =
            await conversationsCollection.updateOne(
              {
                _id: new ObjectId(
                  conversationId
                ),
                participantIds:
                  userId.toString(),
              },
              {
                $set: {
                  [`unread.${userId}`]: 0,
                  updatedAt:
                    new Date().toISOString(),
                },
              }
            );

          if (!result.matchedCount) {
            return res.status(404).send({
              success: false,
              message:
                "Conversation not found",
            });
          }

          res.send({
            success: true,
          });
        } catch (error) {
          console.error(
            "Read conversation error:",
            error
          );

          handleServerError(res, error);
        }
      }
    );

    app.patch(
      "/conversations/:conversationId/block",
      async (req, res) => {
        try {
          const { conversationId } =
            req.params;

          const { userId } = req.body;

          if (!conversationId || !userId) {
            return res.status(400).send({
              success: false,
              message:
                "Conversation and user are required",
            });
          }

          const conversation =
            await conversationsCollection.findOne(
              {
                _id: new ObjectId(
                  conversationId
                ),
                type: "direct",
                participantIds:
                  userId.toString(),
              }
            );

          if (!conversation) {
            return res.status(404).send({
              success: false,
              message:
                "Conversation not found",
            });
          }

          await conversationsCollection.updateOne(
            {
              _id: conversation._id,
            },
            {
              $addToSet: {
                blockedBy:
                  userId.toString(),
              },

              $set: {
                updatedAt:
                  new Date().toISOString(),
              },
            }
          );

          res.send({
            success: true,
            message: "User blocked",
          });
        } catch (error) {
          console.error(
            "Block user error:",
            error
          );

          handleServerError(res, error);
        }
      }
    );

    // ============================== Admin User Direct Coverstiaon ===========================

    app.post("/conversations/admin/start", async (req, res) => {
      try {
        const { adminId, userId } = req.body;

        if (!adminId || !userId) {
          return res.status(400).send({
            success: false,
            message: "Admin ID and user ID are required",
          });
        }

        const targetUser = await usersCollection.findOne({
          _id: new ObjectId(userId),
        });

        if (!targetUser) {
          return res.status(404).send({
            success: false,
            message: "User not found",
          });
        }

        const existingConversation =
          await conversationsCollection.findOne({
            participants: {
              $all: [adminId, userId],
            },
            ended: { $ne: true },
          });

        if (existingConversation) {
          return res.send({
            success: true,
            existing: true,
            conversation: existingConversation,
          });
        }

        const conversation = {
          participants: [adminId, userId],
          messages: [],
          lastMessage: "",
          lastMessageAt: null,
          unread: {
            [adminId]: 0,
            [userId]: 0,
          },
          blockedBy: [],
          ended: false,
          createdAt: new Date().toISOString(),
          type: "admin",
        };

        const result =
          await conversationsCollection.insertOne(
            conversation
          );

        res.send({
          success: true,
          existing: false,
          conversation: {
            ...conversation,
            _id: result.insertedId,
          },
        });
      } catch (error) {
        handleServerError(res, error);
      }
    });


    /* ========================= JWT ========================= */

    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;

        const token = jwt.sign(
          user,
          process.env.ACCESS_TOKEN,
          {
            expiresIn: "365d",
          }
        );

        res.send({ token });
      } catch (error) {
        sendError(res, error);
      }
    });

    app.get("/", (req, res) => {
      res.send("Bookshelf Server Running...");
    });

    await client.db("admin").command({
      ping: 1,
    });

    console.log("MongoDB Connected Successfully");

  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}

run().catch(console.dir);

process.on("unhandledRejection", err => {
  console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err);
});

process.on("SIGINT", async () => {
  try {
    await client.close();
    console.log("MongoDB Connection Closed");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});

app.listen(port, () => {
  console.log(`Bookshelf Server Running On Port ${port}`);
});