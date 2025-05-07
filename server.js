const express = require('express');
const mysql = require('mysql');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require("dotenv")
const path = require("path")
const cookieParser = require('cookie-parser');
const app = express();
const port = 3002;
dotenv.config( {path : "./.env"})

app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

// Connexion MySQL
const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user :process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
})

const publicDirectory = path.join(__dirname,'./public')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(publicDirectory))
app.use(express.urlencoded({extended: false})); 
app.use(express.json());

app.set("view engine", "hbs");
app.use('/', require('./routes/pages'));
app.use('/auth', require('./routes/auth'));
app.use(express.urlencoded({ extended: true })); 


db.connect((err) =>{
  if(err){
    console.log(err);
  }
  else{
    console.log("Connected to database");
  }
})

app.use('/', require('./routes/pages'));
app.use('/auth', require('./routes/auth'));
app.use(express.urlencoded({ extended: true })); 
// Création examen avec lien unique
app.post('/create-exam', (req, res) => {
  const title = req.body.title;
  const description = req.body.description;
  const examId = uuidv4();

  const sql = 'INSERT INTO exams (title, description, exam_id) VALUES (?, ?, ?)';
  db.query(sql, [title, description, examId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur création examen');
    }

    const link = `http://localhost:3000/exam/${examId}`;
    res.send({ message: 'Examen créé avec succès', link });
  });
});

// Accès à l’examen
app.get('/exam/:exam_id', (req, res) => {
  const examId = req.params.exam_id;

  const sqlExam = "SELECT * FROM exams WHERE id = ?";
  const sqlQuestions = "SELECT * FROM questions WHERE exam_id = ?";
  const sqlOptions = "SELECT * FROM options WHERE question_id IN (?)";
  const sqlDirectAnswers = "SELECT * FROM direct_answers WHERE question_id IN (?)";

  db.query(sqlExam, [examId], (err, examResults) => {
    if (err || examResults.length === 0) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const exam = examResults[0];

    db.query(sqlQuestions, [examId], (err, questionResults) => {
      if (err) return res.status(500).json({ error: "Error fetching questions" });

      if (questionResults.length === 0) {
        exam.questions = [];
        return res.json(exam);
      }

      const questionIds = questionResults.map(q => q.id);

      db.query(sqlOptions, [questionIds], (err, optionResults) => {
        if (err) return res.status(500).json({ error: "Error fetching options" });

        db.query(sqlDirectAnswers, [questionIds], (err, answerResults) => {
          if (err) return res.status(500).json({ error: "Error fetching direct answers" });

          const questionsWithDetails = questionResults.map(q => {
            const options = optionResults.filter(o => o.question_id === q.id);
            const answer = answerResults.find(a => a.question_id === q.id);

            return {
              ...q,
              options: options.map(o => ({
                id: o.id,
                text: o.option_text,
                is_correct: !!o.is_correct,
              })),
              correct_answer: answer ? answer.correct_answer : null,
            };
          });

          exam.questions = questionsWithDetails;
          res.json(exam);
        });
      });
    });
  });
});



app.listen(port, () => {
  console.log(`Serveur en écoute sur http://localhost:${port}`);
});
