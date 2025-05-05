const express  = require("express");
const authcontroller = require('../controullers/auth');

const router = express.Router();

router.post("/register",authcontroller.register);

router.post("/login",authcontroller.login);
router.post("/create_exam",authcontroller.create_exam);
router.get('/exams', authcontroller.get_exams);

module.exports = router;