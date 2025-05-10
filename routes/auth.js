const express = require("express");
const multer = require("multer");
const authcontroller = require("../controullers/auth");

const router = express.Router();

const upload = multer({ dest: "uploads/" }); // Configure multer for file uploads

router.post("/register", authcontroller.register);

router.post("/login", authcontroller.login);
router.post("/create_exam", authcontroller.create_exam);
router.get("/exams", authcontroller.get_exams);
router.get("/exams/:id", authcontroller.get_exam_by_id);
router.put("/exams/:id", authcontroller.update_exam);
router.delete("/exams/:id", authcontroller.delete_exam);

router.post("/upload_media", upload.single("media"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  // Save the file or process it as needed
  const mediaUrl = `/uploads/${req.file.filename}`;
  const mediaType = req.file.mimetype;
  res.json({ mediaUrl, mediaType });
});



module.exports = router;
