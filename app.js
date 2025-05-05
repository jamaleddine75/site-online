const express = require('express');
const mysql = require('mysql2/promise'); // Changed to promise version
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require("dotenv");
const path = require("path");
const app = express(); 

dotenv.config({ path: "./.env" });
const PORT = process.env.PORT || 3001;

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection
pool.getConnection()
  .then(conn => {
    console.log("Connected to database");
    conn.release();
  })
  .catch(err => {
    console.error("Database connection failed:", err);
  });

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors()); // Added CORS middleware
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Routes
app.get('/', (req, res) => {
    res.render('create_exam');
});

app.post('/api/exams', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { title, description, questions ,timeLimit} = req.body;

    const [examResult] = await connection.query(
      'INSERT INTO exams (title, description,timeLimit) VALUES (?, ?,?)',
      [title, description,timeLimit]
    );

    const examId = examResult.insertId;

    for (const question of questions) {
      const [questionResult] = await connection.query(
        "INSERT INTO questions (exam_id, question_text, question_type,points,position) VALUES (?, ?, ?,?,?)",
        [examId, question.text, question.type,question.points,question.position]
      );

      const questionId = questionResult.insertId;

      if (question.type === 'multiple-choice') {
        for (let i = 0; i < question.options.length; i++) {
          await connection.query(
            'INSERT INTO options (question_id, text, is_correct) VALUES (?, ?, ?)',
            [questionId, question.options[i], i === question.correctAnswer]
          );
        }
      }if (question.type === 'direct-answer') {
        await connection.query(
          'INSERT INTO direct_answers (question_id, correct_answer) VALUES (?, ?)',
          [questionId, question.correctAnswer]
        );
      }

    }

    await connection.commit();
    res.status(201).json({ message: 'Exam created successfully', examId });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error creating exam:', error);
    res.status(500).json({ error: 'Failed to create exam' });
  } finally {
    if (connection) connection.release();
  }
});

// Get Exam by ID
app.get('/api/exams/:id', async (req, res) => {
    let connection;
    try {
      connection = await pool.getConnection();
      const [exams] = await connection.query('SELECT * FROM exams WHERE id = ?', [req.params.id]);
      
      if (exams.length === 0) {
        return res.status(404).json({ error: 'Exam not found' });
      }
  
      const exam = exams[0];
      const [questions] = await connection.query('SELECT * FROM questions WHERE exam_id = ?', [exam.id]);
  
      for (const question of questions) {
        if (question.type === 'multiple-choice') {
          const [options] = await connection.query(
            'SELECT text, is_correct FROM options WHERE question_id = ?', 
            [question.id]
          );
          question.options = options.map(opt => opt.text);
          question.correctAnswer = options.findIndex(opt => opt.is_correct);
        }
      }
  
      res.json({
        ...exam,
        questions: questions
      });
  
    } catch (error) {
      console.error('Error fetching exam:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (connection) connection.release();
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});