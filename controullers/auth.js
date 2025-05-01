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
      secure: process.env.NODE_ENV === 'production', // true en prod avec HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 1 jour
    });

    console.log("Login successful!");
    console.log("jwt cree",token);
    res.render('home',{ message: "Login successful" });


    
  });

};

  
exports.crea_examan = (req, res) => {
  console.log(req.body);

  const { name, duree, propieter, description, type } = req.body;

  if (!name || !duree || !propieter || !description || !type) {
    // Assuming flash or session-based messaging
    
    return res.redirect('/crea_examan');
  }

  const checkExamQuery = "SELECT name FROM exams WHERE name = ?";
  db.query(checkExamQuery, [name], (error, results) => {
    if (error) {
      console.error("Error during exam name check:", error);
      
      return res.redirect('/crea_examan');
    }

    if (results.length > 0) {
      return res.redirect('/crea_examan',{message :"That exam name is already in use"});
    }

    const examData = { name, duree, propieter, description, type };

    db.query("INSERT INTO exams SET ?", examData, (error, results) => {
      if (error) {
        console.error("Error inserting exam:", error);
       
        return res.redirect('/crea_examan',{message :"Failed to create exam"});
      }
        else{
           console.log("Exam created successfully!");

      // Redirect based on type
      if (type.toLowerCase() == "qcm") {
        console.log("QCM question type selected");
        return res.render('qcm_q');
      } else if (type.toLowerCase() == "direct") {
        console.log("Direct question type selected");
        return res.redirect('/dirict_q');
      } else {
        console.log("Unknown question type selected");
       
        return res.render('/crea_examan',{message : "Unknown question type selected"});
      }
        }
     
    });
  });
};

exports.dirict_q = async (req, res) => {
  try {
    // 1. Destructure and validate input
    const { question_text, correct_answer, time_limit, points, exam_id } = req.body;

    if (!question_text && !correct_answer && !points && !exam_id) {
      return res.status(400).render('dirict_q', {
        message: 'All fields are required (question_text, correct_answer, points, exam_id)'
      });
    }

    // 2. Verify exam exists first
    const examCheck = await new Promise((resolve, reject) => {
      db.query('SELECT 1 FROM exams WHERE exam_id = ?', [exam_id], (err, results) => {
        if (err) reject(err);
        resolve(results);
      });
    });

    if (examCheck.length === 0) {
      return res.status(404).render('dirict_q', {
        message: `Exam with ID ${exam_id} not found`
      });
    }

    // 3. Insert the question
    const insertResult = await new Promise((resolve, reject) => {
      db.query(
        'INSERT INTO direct_questions SET ?', 
        {
          exam_id: exam_id,
          question_text: question_text,
          correct_answer: correct_answer,
          time_limit: time_limit || null,
          points: points
        },
        (err, results) => {
          if (err) reject(err);
          resolve(results);
        }
      );
    });

    // 4. Success response
    return res.status(201).render('dirict_q', {
      success: true,
      message: 'Direct question added successfully!',
      questionId: insertResult.insertId
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).render('dirict_q', {
      message: 'An error occurred while adding the question'
    });
  }
};
exports.qcm_q = (req, res) => {
  console.log(req.body);
  const { qestion,time, pionte,chois1,chois2,chois3,chois4,chois5,chois6 } = req.body;

  if (!qestion) {
   
    return res.redirect('/qcm_q',{message : "Question is required"});
  }

  db.query('INSERT INTO qcm SET ?', { qestion: qestion,
     time:time,
     pionte:pionte,
     chois1:chois1,
     chois2:chois2
     ,chois3:chois3
     ,chois4:chois4,
     chois5:chois5,
     chois6:chois6}, (error, results) => {
    if (error) {
      console.log(error);
      
      return res.render('qcm_q',{message : "Failed to create question"});
    } else {
      
      return res.render('qcm_q',{message :  "QCM question created successfully"});
    }
  });
};
