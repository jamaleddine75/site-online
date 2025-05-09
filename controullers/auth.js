const mysql = require("mysql");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
});

exports.db = db;

exports.register = (req, res) => {
  console.log(req.body);

  const { name, email, date, password, confirmpassword, gender } = req.body;

  db.query(
    "SELECT email FROM users WHERE email = ?",
    [email],
    async (error, results) => {
      if (error) {
        console.log(error);
      }
      if (results.length > 0) {
        return res.render("register", {
          message: "That email is already in use",
        });
      } else if (password !== confirmpassword) {
        return res.render("register", {
          message: "Passwords do not match",
        });
      }

      let hashedpassword = await bcrypt.hash(password, 8);
      console.log(hashedpassword);

      db.query(
        "INSERT INTO users SET ?",
        {
          name: name,
          email: email,
          date: date,
          password: hashedpassword,
          gender: gender,
        },
        (error, results) => {
          if (error) {
            console.log(error);
          } else {
            return res.render("login", {
              message: "User registered",
            });
          }
        }
      );
    }
  );
};
exports.login = async (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) {
        console.log(err);
        return res.render("login", { message: "server errer " });
      }

      if (results.length === 0) {
        console.log("Email not found");
        return res.render("login", {
          message: "Email or password is incorrect",
        });
      }

      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        console.log("Password incorrect");
        return res.render("login", {
          message: "Email or password is incorrect",
        });
      }
      // Crée le token JWT
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      });

      // Envoie le token dans un cookie sécurisé
      res.cookie("jwt", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      });

      console.log("Login successful!");
      console.log("jwt cree", token);

      res.redirect("/home");
    }
  );
};

exports.create_exam = (req, res) => {
  const { title, description, timeLimit, questions } = req.body;

  console.log("Exam Details:", { title, description, timeLimit, questions });

  // Validate questions is an array
  if (!Array.isArray(questions)) {
    return res.status(400).json({ error: "Questions should be an array" });
  }

  // Extract user email from the JWT token
  const token = req.cookies.jwt;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // Insert exam
    db.query(
      "INSERT INTO exams (title, description, time_limit, created_by) VALUES (?, ?, ?, ?)",
      [title, description, timeLimit, userId],
      (err, result) => {
        if (err) {
          console.error("Error inserting exam:", err);
          return res.status(500).json({ error: "Database error" });
        }

        const examId = result.insertId;

        // Process each question
        const questionInserts = questions.map((q, index) => {
          return new Promise((resolve, reject) => {
            // Insert question
            db.query(
              "INSERT INTO questions (exam_id, question_text, question_type, points, position,timer,mediaUrl,mediaType ) VALUES (?, ?, ?, ?, ?,?,?,?)",
              [examId, q.question_text, q.question_type, q.points, q.position,q.timer, q.mediaUrl,q.mediaType],
              (err, questionResult) => {
                if (err) return reject(err);

                const questionId = questionResult.insertId;

                // Handle multiple-choice questions
                if (q.question_type === "multiple-choice") {
                  if (!q.options || q.options.length === 0) {
                    return reject(
                      new Error("Multiple-choice questions require options")
                    );
                  }

                  const optionInserts = q.options.map((opt, idx) => {
                    return new Promise((resOpt, rejOpt) => {
                      db.query(
                        "INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)",
                        [questionId, opt, idx === q.correctOption],
                        (err) => (err ? rejOpt(err) : resOpt())
                      );
                    });
                  });

                  Promise.all(optionInserts).then(resolve).catch(reject);
                }
                // Handle direct-answer questions
                else if (q.question_type === "direct-answer") {
                  if (!q.correct_answer) {
                    return reject(
                      new Error(
                        "Direct-answer questions require a correct answer"
                      )
                    );
                  }

                  db.query(
                    "INSERT INTO direct_answers (question_id, correct_answer) VALUES (?, ?)",
                    [questionId, q.correct_answer],
                    (err) => (err ? reject(err) : resolve())
                  );
                } else {
                  reject(
                    new Error(`Unknown question type: ${q.question_type}`)
                  );
                }
              }
            );
          });
        });

        Promise.all(questionInserts)
          .then(() => res.json({ message: "Exam created", examId }))
          .catch((err) => {
            console.error("Error:", err);
            res
              .status(500)
              .json({ error: err.message || "Error creating exam" });
          });
      }
    );
  } catch (err) {
    console.error("Error verifying token:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};

exports.get_exam_by_id = (req, res) => {
  const examId = req.params.id;

  const sqlExam = "SELECT * FROM exams WHERE id = ?";
  const sqlQuestions = "SELECT * FROM questions WHERE exam_id = ?";
  const sqlOptions = "SELECT * FROM options WHERE question_id IN (?)";
  const sqlDirectAnswers =
    "SELECT * FROM direct_answers WHERE question_id IN (?)";

  db.query(sqlExam, [examId], (err, examResults) => {
    if (err || examResults.length === 0) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const exam = examResults[0];

    db.query(sqlQuestions, [examId], (err, questionResults) => {
      if (err) {
        return res.status(500).json({ error: "Error fetching questions" });
      }

      if (questionResults.length === 0) {
        exam.questions = [];
        return res.json(exam);
      }

      const questionIds = questionResults.map((q) => q.id);

      db.query(sqlOptions, [questionIds], (err, optionResults) => {
        if (err) {
          return res.status(500).json({ error: "Error fetching options" });
        }

        db.query(sqlDirectAnswers, [questionIds], (err, answerResults) => {
          if (err) {
            return res
              .status(500)
              .json({ error: "Error fetching direct answers" });
          }

          // Merge options and direct answers into questions
          const questionsWithDetails = questionResults.map((q) => {
            const options = optionResults.filter((o) => o.question_id === q.id);
            const answerObj = answerResults.find((a) => a.question_id === q.id);

            return {
              ...q,
              options: options.length
                ? options.map((o) => ({
                    id: o.id,
                    text: o.option_text,
                    is_correct: !!o.is_correct,
                  }))
                : undefined,
              correct_answer: answerObj ? answerObj.correct_answer : undefined,
            };
          });

          exam.questions = questionsWithDetails;
          res.json(exam);
        });
      });
    });
  });
};

exports.get_exams = (req, res) => {
  const token = req.cookies.jwt;
  if (!token) {
    console.error("JWT token is missing");
    return res
      .status(401)
      .json({ error: "Unauthorized: JWT token is missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const sql = "SELECT * FROM exams WHERE created_by = ?";
    db.query(sql, [userId], (err, results) => {
      if (err) {
        console.error("Error fetching exams:", err);
        return res.status(500).json({ error: "Database error" });
      }

      res.json(results);
    });
  } catch (err) {
    console.error("Error verifying token:", err);
    res.status(401).json({ error: "Invalid token" });
  }
};

exports.update_exam = (req, res) => {
  const examId = req.params.id;
  const { title, description, time_limit, questions } = req.body;
  const token = req.cookies.jwt;

  if (!token) {
    console.error("JWT token is missing");
    return res.status(401).json({ error: "Unauthorized: JWT token is missing" });
  }

  // Decode the token to get the user ID
  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch (err) {
    console.error("Error verifying token:", err);
    return res.status(401).json({ error: "Invalid token" });
  }

  // Verify ownership of the exam
  const verifyOwnershipSql = "SELECT * FROM exams WHERE id = ? AND created_by = ?";
  db.query(verifyOwnershipSql, [examId, userId], (err, results) => {
    if (err) {
      console.error("Error verifying ownership:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(403).json({ error: "You are not authorized to update this exam" });
    }

    // Update exam info
    const updateExamSql = "UPDATE exams SET title = ?, description = ?, time_limit = ? WHERE id = ?";
    db.query(updateExamSql, [title, description, time_limit, examId], (err) => {
      if (err) {
        console.error("Error updating exam:", err);
        return res.status(500).json({ error: "Failed to update exam" });
      }

      // Fetch old questions
      const fetchQuestionsSql = "SELECT id FROM questions WHERE exam_id = ?";
      db.query(fetchQuestionsSql, [examId], (err, questionRows) => {
        if (err) {
          console.error("Error fetching old questions:", err);
          return res.status(500).json({ error: "Failed to fetch old questions" });
        }

        const questionIds = questionRows.map((row) => row.id);

        // Delete old questions and related data
        const deleteOldData = () => {
          return new Promise((resolve, reject) => {
            const deleteOptionsSql = "DELETE FROM options WHERE question_id IN (?)";
            const deleteDirectAnswersSql = "DELETE FROM direct_answers WHERE question_id IN (?)";
            const deleteQuestionsSql = "DELETE FROM questions WHERE exam_id = ?";

            db.query(deleteOptionsSql, [questionIds], (err) => {
              if (err) return reject(err);

              db.query(deleteDirectAnswersSql, [questionIds], (err) => {
                if (err) return reject(err);

                db.query(deleteQuestionsSql, [examId], (err) => {
                  if (err) return reject(err);
                  resolve();
                });
              });
            });
          });
        };

        deleteOldData()
          .then(() => {
            // Insert updated questions
            const insertQuestions = questions.map((q) => {
              return new Promise((resolve, reject) => {
                const insertQuestionSql =
                  "INSERT INTO questions (exam_id, question_text, question_type, points, timer) VALUES (?, ?, ?, ?, ?)";
                db.query(
                  insertQuestionSql,
                  [examId, q.text, q.type, q.Points, q.timer],
                  (err, result) => {
                    if (err) return reject(err);

                    const questionId = result.insertId;

                    if (q.type === "multiple-choice") {
                      if (!q.options || q.options.length === 0) {
                        return reject(new Error("Multiple-choice questions require options"));
                      }

                      const insertOptions = q.options.map((opt, idx) => {
                        return new Promise((resOpt, rejOpt) => {
                          const insertOptionSql =
                            "INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)";
                          db.query(
                            insertOptionSql,
                            [questionId, opt, idx === q.correctOption],
                            (err) => (err ? rejOpt(err) : resOpt())
                          );
                        });
                      });

                      Promise.all(insertOptions)
                        .then(resolve)
                        .catch(reject);
                    } else if (q.type === "direct-answer") {
                      if (!q.correctAnswer) {
                        return reject(new Error("Direct-answer questions require a correct answer"));
                      }

                      const insertDirectAnswerSql =
                        "INSERT INTO direct_answers (question_id, correct_answer) VALUES (?, ?)";
                      db.query(insertDirectAnswerSql, [questionId, q.correctAnswer], (err) =>
                        err ? reject(err) : resolve()
                      );
                    } else {
                      reject(new Error(`Unknown question type: ${q.type}`));
                    }
                  }
                );
              });
            });

            Promise.all(insertQuestions)
              .then(() => res.json({ message: "Exam updated successfully" }))
              .catch((err) => {
                console.error("Error inserting updated questions:", err);
                res.status(500).json({ error: err.message || "Error inserting updated questions" });
              });
          })
          .catch((err) => {
            console.error("Error deleting old questions:", err);
            res.status(500).json({ error: "Failed to delete old questions" });
          });
      });
    });
  });
};

exports.delete_exam = (req, res) => {
  const examId = req.params.id;

  // Delete questions and options related to the exam first
  const deleteOptionsSql =
    "DELETE FROM options WHERE question_id IN (SELECT id FROM questions WHERE exam_id = ?)";
  const deleteDirectAnswersSql =
    "DELETE FROM direct_answers WHERE question_id IN (SELECT id FROM questions WHERE exam_id = ?)";

  const deleteQuestionsSql = "DELETE FROM questions WHERE exam_id = ?";
  const deleteExamSql = "DELETE FROM exams WHERE id = ?";
  db.query(deleteOptionsSql, [examId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to delete options." });
    }

    // Delete direct answers related to the questions
    db.query(deleteDirectAnswersSql, [examId], (err) => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({ error: "Failed to delete direct answers." });
      }
    });
  });
  db.query(deleteDirectAnswersSql, [examId], (err) => {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "Failed to delete direct answers." });
    }

    // Delete questions related to the exam
  });

  db.query(deleteQuestionsSql, [examId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to delete questions." });
    }

    // Delete the exam after deleting its questions
    db.query(deleteExamSql, [examId], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to delete exam." });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Exam not found." });
      }

      res
        .status(200)
        .json({ message: "Exam and its related data deleted successfully." });
    });
  });
};
