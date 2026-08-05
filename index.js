const express = require('express');
const jwt = require("jsonwebtoken");
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { jwtDecode } = require('jwt-decode');
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
require('dotenv').config();
const app = express();
const port = process.env.PORT || 2000;
// Middleware
app.use(cors());
app.use(express.json());

// // JWT Token Verify
// const verifyToken = (req, res, next) => {

//   const authorization = req.headers.authorization;
//   if (!authorization) {
//     return res.status(401).send({ status: false, message: 'You are unauthorized' })
//   }
//   const token = authorization.split(' ')[1];

//   jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
//     console.log(decoded);
//     console.log(error)
//     if (error) {
//       return res.status(403).send({ status: false, message: `Forbidden access`, error: error })
//     }
//     req.decoded = decoded
//     next();
//   })
// }






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@bookshelfcluster.p3s31ub.mongodb.net/?ssl=true&retryWrites=true&w=majority&appName=bookshelfCluster`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    const booksCollection = client.db('bookshelf').collection('books');
    const newsCollection = client.db('bookshelf').collection('news');
    const eventsCollection = client.db('bookshelf').collection('events');
    const membersCollection = client.db('bookshelf').collection('community_member');
    const usersCollection = client.db('bookshelf').collection('users');
    const cartCollection = client.db('bookshelf').collection('cart');
    const usersResponsesCollection = client.db('bookshelf').collection('users_responses');


    // app.get('*', (req, res) => {
    //   res.sendFile(path.join(__dirname + '/client/build/index.html'));
    // });

    // JWT Token
    // app.post('/jwt', (req, res) => {
    //   const user = req.body;
    //   const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
    //     expiresIn: '1h'
    //   })
    //   res.send({ status: true, token })
    // })

    app.delete('/delete-image', async (req, res) => {
      const { public_id } = req.body;

      try {
        const result = await cloudinary.uploader.destroy(public_id);
        if (result.result === 'ok') {
          res.status(200).send({ message: 'Image deleted successfully' });
        } else {
          res.status(404).send({ message: 'Image not found' });
        }
      } catch (error) {
        res.status(500).send({ message: 'Failed to delete image', error });
      }
    });

    // Books Operations
    app.get('/books', async (req, res) => {
      const books = await booksCollection.find().toArray();
      res.send(books);
    });

    app.get('/book/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const book = await booksCollection.find(query).toArray();
      res.send(book);
    })

    app.put("/books/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const book = req.body;
        const filter = {
          _id: new ObjectId(id),
        };

        const updateDoc = {
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
        };

        const result = await booksCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });


    app.post('/book', async (req, res) => {
      const book = req.body;
      const result = await booksCollection.insertOne(book);
      res.send(result);
    })

    app.delete('/books/:id', async (req, res) => {
      const itemId = req.params.id;
      const query = { _id: new ObjectId(itemId) };
      const result = await booksCollection.deleteOne(query);
      res.send(result)
    })

    app.post("/cart", async (req, res) => {
      try {

        const { email, book } = req.body;

        if (!email || !book) {
          return res.status(400).send({
            success: false,
            message: "Email and Book ID are required."
          });
        }

        const userCart = await cartCollection.findOne({ email });

        // First Cart
        if (!userCart) {

          const result = await cartCollection.insertOne({
            email,
            book: [book],
            createdAt: new Date()
          });

          return res.send({
            success: true,
            insertedId: result.insertedId,
            message: "Book added to cart."
          });

        }

        // Make sure book array exists
        const books = Array.isArray(userCart.book)
          ? userCart.book
          : [];

        // Duplicate Check
        if (books.includes(book)) {

          return res.send({
            success: false,
            alreadyExists: true,
            message: "Book already exists in cart."
          });

        }

        // Add New Book
        await cartCollection.updateOne(
          { email },
          {
            $push: {
              book: book
            }
          }
        );

        return res.send({
          success: true,
          message: "Book added successfully."
        });

      }
      catch (error) {

        console.log(error);

        return res.status(500).send({
          success: false,
          message: "Internal Server Error"
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

          _id: { $in: ids }

        }).toArray();

        const finalBooks = books.map(book => ({

          ...book,

          quantity: 1

        }));

        res.send(finalBooks);

      }

      catch (err) {

        console.log(err);

        res.status(500).send({

          success: false,

          message: err.message

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

              book: bookId

            }

          }

        );

        res.send({

          success: true,

          message: "Removed Successfully"

        });

      }

      catch (err) {

        console.log(err);

        res.status(500).send({

          success: false,

          message: err.message

        });

      }

    });

    // News Operations
    app.get('/news', async (req, res) => {
      const news = await newsCollection.find().toArray();
      res.send(news);
    });

    // Event Operations
    app.get('/events', async (req, res) => {
      const events = await eventsCollection.find().toArray();
      res.send(events);
    });

    // Member Operations
    app.get('/members', async (req, res) => {
      const members = await membersCollection.find().toArray();
      res.send(members);
    });

    // Users Operations
    app.get('/users', async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email; // Correctly access the 'email' query parameter
      if (!email) {
        return res.status(400).send({ error: "Email query parameter is required" });
      }

      const query = { email: email };
      // console.log(email);

      const result = await usersCollection.find(query).toArray();
      // console.log(result);

      res.send(result);

    })

    app.post('/users', async (req, res) => {
      const userData = req.body;
      const result = await usersCollection.insertOne(userData);
      return res.send(result)

    })

    app.put("/users/:email", async (req, res) => {

      try {

        const email = req.params.email;

        const {
          first_name,
          last_name,
          phone_number,
          address,
          gender,
          image,
        } = req.body;

        const filter = { email };

        const updateDoc = {

          $set: {

            first_name,
            last_name,
            phone_number,
            address,
            gender,
            image,

          },

        };

        const result = await usersCollection.updateOne(
          filter,
          updateDoc
        );

        if (result.matchedCount === 0) {

          return res.status(404).send({

            success: false,
            message: "User not found",

          });

        }

        return res.send({

          success: true,
          message: "Profile updated successfully",

        });

      } catch (err) {

        console.log(err);

        return res.status(500).send({

          success: false,
          message: "Internal Server Error",

        });

      }

    });

    app.put("/users/profile_image/:email", async (req, res) => {

      try {

        const email = req.params.email;
        const { image } = req.body;

        if (!email || !image) {

          return res.status(400).send({
            success: false,
            message: "Email and Image URL are required.",
          });

        }

        const result = await usersCollection.updateOne(

          {
            email: email,
          },

          {
            $set: {
              image: image,
            },
          }

        );

        if (result.matchedCount === 0) {

          return res.status(404).send({

            success: false,

            message: "User not found.",

          });

        }

        res.send({

          success: true,

          message: "Profile image updated successfully.",

          modifiedCount: result.modifiedCount,

        });

      }

      catch (error) {

        console.error(error);

        res.status(500).send({

          success: false,

          message: "Internal Server Error",

        });

      }

    });


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

        console.log(error);

        res.status(500).send({
          success: false,
          message: "Internal Server Error"
        });

      }

    });

    app.put("/community/member", async (req, res) => {

      const member = req.body;

      const filter = {
        name: member.name,
      };

      const updateDoc = {

        $set: {

          role: member.role,
          description: member.description,
          image: member.image,

        },

      };

      const options = {

        upsert: true,

      };

      const result = await communityCollection.updateOne(

        filter,
        updateDoc,
        options

      );

      res.send(result);

    });

    app.post("/users_responses", async (req, res) => {

      try {

        const { name, email, subject, message, createdAt } = req.body;

        if (!name || !email || !subject || !message) {

          return res.status(400).send({
            success: false,
            message: "All fields are required.",
          });

        }
        console.log(req.body)
        const result = await usersResponsesCollection.insertOne({
          name,
          email,
          subject,
          message,
          createdAt
        });

        res.send({
          success: true,
          insertedId: result.insertedId,
        });

      } catch (error) {

        console.error(error);

        res.status(500).send({
          success: false,
          message: "Internal Server Error",
        });

      }

    });

    app.patch("/books/review/:id", async (req, res) => {
      const id = req.params.id;
      const review = req.body;

      const result = await booksCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $push: {
            user_reviews: {
              user: review.user,
              rating: review.rating,
              comment: review.comment,
            },
          },
        }
      );

      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Welcome to bookshelf project server');
});

app.listen(port, () => {
  console.log(`bookshelf running on port ${port}`);
});