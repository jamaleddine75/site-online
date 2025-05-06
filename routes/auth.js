const express  = require("express");
const authcontroller = require('../controullers/auth');

const router = express.Router();

router.post("/register",authcontroller.register);

router.post("/login",authcontroller.login);
router.post("/create_exam",authcontroller.create_exam);
router.get('/exams', authcontroller.get_exams);
router.get('/exams/:id', authcontroller.get_exam_by_id);
router.put('/exams/:id', authcontroller.update_exam);

module.exports = router;