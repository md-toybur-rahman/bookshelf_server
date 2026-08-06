const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { jwtDecode } = require("jwt-decode");
const cloudinary = require("cloudinary").v2;
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
        return res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    /* ========================= BOOK ========================= */

    app.get("/books", async (req, res) => {
      try {
        const books = await booksCollection.find().toArray();
        res.send(books);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.post("/book", async (req, res) => {
      try {
        const result = await booksCollection.insertOne(req.body);
        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    /* ========================= EVENTS ========================= */

    app.get("/events", async (req, res) => {
      try {
        const events = await eventsCollection.find().toArray();
        res.send(events);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    /* ========================= EVENT JOIN ========================= */

    app.get("/event/join", async (req, res) => {
      try {
        const events = await eventJoinCollection.find().toArray();
        res.send(events);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
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

        return res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    /* ========================= MEMBERS ========================= */

    app.get("/members", async (req, res) => {
      try {
        const members = await membersCollection.find().toArray();
        res.send(members);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.post("/members", async (req, res) => {
      try {
        const member = req.body;

        const result = await membersCollection.insertOne(member);

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    /* ========================= USERS ========================= */

    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    /* ========================= USER RESPONSES ========================= */

    app.get("/responses", async (req, res) => {
      try {
        const result = await usersResponsesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.post("/responses", async (req, res) => {
      try {
        const response = req.body;

        const result = await usersResponsesCollection.insertOne(response);

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
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
        res.status(500).send({
          success: false,
          message: error.message,
        });
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