const express = require('express');
const jwt = require("jsonwebtoken");
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 2000;

// Middleware
app.use(cors());
app.use(express.json());

// JWT Token Verify
const verifyToken = (req, res, next) => {

  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ status: false, message: 'You are unauthorized' })
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
    if (error) {
      return res.status(403).send({ status: false, message: 'Forbidden access', error: error })
    }
    req.decoded = decoded
  })

  next();
}






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


    // JWT Token
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: '7d'
      })
      res.send({ status: true, token })
    })


    app.get('/books', async (req, res) => {
      const id = req.query.id;
      if (id) {
        const query = { _id: new ObjectId(id) }
        const book = await booksCollection.findOne(query);
        return res.send(book);
      }
      const books = await booksCollection.find().toArray();
      res.send(books);
    });

    app.get('/book/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const book = await booksCollection.find(query).toArray();
      res.send(book);
    })

    app.put('/books', verifyToken, async (req, res) => {
      const id = req.query.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedBook = req.body;
      const book = {
        $set: {
          book_name: updatedBook.book_name,
          author_name: updatedBook.author_name,
          publisher_name: updatedBook.publisher_name,
          publication_date: updatedBook.publication_date,
          language: updatedBook.language,
          genre: updatedBook.genre,
          number_of_pages: updatedBook.number_of_pages,
          dimensions: { height: updatedBook.number_of_pages, width: updatedBook.width },
          price: updatedBook.price,
        }
      }
      const result = await booksCollection.updateOne(filter, book, options);
      res.send(result);
    })

    app.post('/book', verifyToken, async (req, res) => {
      const book = req.body;
      const result = await booksCollection.insertOne(book);
      res.send(result);
    })

    app.delete('/books', verifyToken, async (req, res) => {
      const itemId = req.query.id;
      const query = { _id: new ObjectId(itemId) };
      const result = await booksCollection.deleteOne(query);
      res.send(result)
    })

    app.get('/news', async (req, res) => {
      const news = await newsCollection.find().toArray();
      res.send(news);
    });


    app.get('/events', async (req, res) => {
      const events = await eventsCollection.find().toArray();
      res.send(events);
    });


    app.get('/members', async (req, res) => {
      const members = await membersCollection.find().toArray();
      res.send(members);
    });

    app.get('/users', async (req, res) => {
      const email = req.query.email; // Correctly access the 'email' query parameter
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
      const email = req.query.email;
      const query = { email: email };
      const userData = req.body;
      const isUserExist = await usersCollection.findOne(query);
      if (isUserExist) {
        return res.send({
          status: "success",
          message: "Login Success",
          email: email
        });
      }
      else {
        await usersCollection.insertOne(userData);
        return res.send({
          status: "success",
          message: "Login Success",
          email: email
        })
      }
    })




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