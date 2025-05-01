const express = require('express');
const mysql = require('mysql');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require("dotenv")
const path = require("path")
const app = express();
const port = 3002;
dotenv.config( {path : "./.env"})

app.use(cors());
app.use(bodyParser.json());

// Connexion MySQL
const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user :process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
})

const publicDirectory = path.join(__dirname,'./public')
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
  const sql = 'SELECT * FROM exams WHERE exam_id = ?';

  db.query(sql, [examId], (err, result) => {
    if (err || result.length === 0) return res.status(404).send('Examen introuvable');

    res.json(result[0]);
  });
});

app.listen(port, () => {
  console.log(`Serveur en écoute sur http://localhost:${port}`);
});
