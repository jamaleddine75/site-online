const express = require("express");
const { db } = require("../controullers/auth");
const jwt = require("jsonwebtoken");

const router = express.Router();

router.get("/", (req, res) => {
  res.render("login");
});

router.get("/registre", (req, res) => {
  res.render("register");
});

router.get("/home", (req, res) => {
  const token = req.cookies.jwt;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized, no JWT" });
  }
  let userId = null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch (err) {
    return res.status(401).json({ error: `Unauthorized ${err}` });
  }
  db.query("SELECT * FROM users WHERE id = ?", [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = results[0];
    res.render("home", { userName: user.name });
  });
});

router.get("/lien", (req, res) => {
  res.render("lien");
});

router.get("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.render("login"); // Redirect to the login page after logout
    });
  } else {
    res.render("login"); // Redirect even if session is not defined
  }
});

router.get("/create_exam", (req, res) => {
  res.render("create_exam");
});

router.get("/modifierexam/:id", (req, res) => {
  const examId = req.params.id; // Get the exam ID from the URL
  res.render("modifierexam", { examId }); // Pass the exam ID to the template
});

router.get("/takeexam/:examId", (req, res) => {
  const examId = req.params.examId;
  // Fetch exam details and render the takeexam.hbs page
  res.render("takeexam", { examId });
});

module.exports = router;
