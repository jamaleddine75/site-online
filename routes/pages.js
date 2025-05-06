const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.render("login");
});

router.get("/registre", (req, res) => {
    res.render("register");
});

router.get("/home", (req, res) => {
    res.render("home");
});

router.get("/lien", (req, res) => {
    res.render("lien");
});

router.get("/create_exam", (req, res) => {
    res.render("create_exam");
});

router.get("/modifierexam/:id", (req, res) => {
    const examId = req.params.id; // Get the exam ID from the URL
    res.render("modifierexam", { examId }); // Pass the exam ID to the template
});

module.exports = router;