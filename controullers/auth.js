const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user :process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
})


exports.register =(req, res) => {
    console.log(req.body);
    
  
    
    const { name ,email,date,password,confirmpassword,gender} = req.body;

    db.query("SELECT email FROM users WHERE email = ?",[email],async (error,results) =>{      
            if (error){
                console.log(error);
            }
            if (results.length > 0){

                return res.render('register',{
                    message: "That email is already in use" 
                }) 
            }
            else if (password !== confirmpassword){
                return res.render('register',{
                    message: "Passwords do not match"
                })
               
            }
    
            let hashedpassword = await bcrypt.hash(password,8);
            console.log(hashedpassword);

            db.query('INSERT INTO users SET ?',{name:name,email:email,date:date,password:hashedpassword,gender:gender}, (error,results) => {
                if (error){
                    console.log(error);
                }
                else{
                    return res.render('login',{
                        message: "User registered"
                    })
                }
            })
        })

    
}
exports.login = async (req, res) => {
  const { email, password } = req.body;
  

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) {
      console.log(err);
      return res.render('login',{ message: "server errer " });
    }

    if (results.length === 0) {
      console.log("Email not found");
      return res.render('login',{ message: "Email or password is incorrect" });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("Password incorrect");
      return res.render('login',{ message: "Email or password is incorrect" });
    }
    // Crée le token JWT
    const token = jwt.sign(
      { nom: user.nom, email: user.email},
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d'
      }
    );

    // Envoie le token dans un cookie sécurisé
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    console.log("Login successful!");
    console.log("jwt cree",token);
    res.render('home',{ message: "Login successful" });


    
  });

};

  

exports.create_exam = (req, res) => {
  const { title, description, timeLimit, questions } = req.body;

  console.log('Exam Details:', { title, description, timeLimit, questions });

  // Validate questions is an array
  if (!Array.isArray(questions)) {
    return res.status(400).json({ error: 'Questions should be an array' });
  }

  // Extract user email from the JWT token
  const token = req.cookies.jwt;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    // Insert exam
    db.query(
      'INSERT INTO exams (title, description, time_limit, created_by) VALUES (?, ?, ?, ?)',
      [title, description, timeLimit, userEmail],
      (err, result) => {
        if (err) {
          console.error('Error inserting exam:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        const examId = result.insertId;

        // Process each question
        const questionInserts = questions.map((q, index) => {
          return new Promise((resolve, reject) => {
            // Insert question
            db.query(
              'INSERT INTO questions (exam_id, question_text, question_type, points, position) VALUES (?, ?, ?, ?, ?)',
              [examId, q.question_text, q.question_type, q.points, q.position],
              (err, questionResult) => {
                if (err) return reject(err);

                const questionId = questionResult.insertId;

                // Handle multiple-choice questions
                if (q.question_type === 'multiple-choice') {
                  if (!q.options || q.options.length === 0) {
                    return reject(new Error('Multiple-choice questions require options'));
                  }

                  const optionInserts = q.options.map((opt, idx) => {
                    return new Promise((resOpt, rejOpt) => {
                      db.query(
                        'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)',
                        [questionId, opt, idx === q.correctOption],
                        (err) => (err ? rejOpt(err) : resOpt())
                      );
                    });
                  });

                  Promise.all(optionInserts)
                    .then(resolve)
                    .catch(reject);
                } 
                // Handle direct-answer questions
                else if (q.question_type === 'direct-answer') {
                  if (!q.correct_answer) {
                    return reject(new Error('Direct-answer questions require a correct answer'));
                  }

                  db.query(
                    'INSERT INTO direct_answers (question_id, correct_answer) VALUES (?, ?)',
                    [questionId, q.correct_answer],
                    (err) => (err ? reject(err) : resolve())
                  );
                } 
                else {
                  reject(new Error(`Unknown question type: ${q.question_type}`));
                }
              }
            );
          });
        });

        Promise.all(questionInserts)
          .then(() => res.json({ message: 'Exam created', examId }))
          .catch((err) => {
            console.error('Error:', err);
            res.status(500).json({ error: err.message || 'Error creating exam' });
          });
      }
    );
  } catch (err) {
    console.error('Error verifying token:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
};


/*exports.get_exam_by_id = async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();

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

    res.json({ ...exam, questions });

  } catch (error) {
    console.error('Error fetching exam:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
};*/

exports.get_exams = (req, res) => {
  const token = req.cookies.jwt;
  if (!token) {
    console.error('JWT token is missing');
    return res.status(401).json({ error: 'Unauthorized: JWT token is missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    const sql = 'SELECT * FROM exams WHERE created_by = ?';
    db.query(sql, [userEmail], (err, results) => {
      if (err) {
        console.error('Error fetching exams:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json(results);
    });
  } catch (err) {
    console.error('Error verifying token:', err);
    res.status(401).json({ error: 'Invalid token' });
  }
};