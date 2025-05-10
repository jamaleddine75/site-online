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

  const mediaUrl = `/uploads/${req.file.filename}`;
  const mediaType = req.file.mimetype;
  res.json({ mediaUrl, mediaType });
});

router.post('/save-coordinates', (req, res) => {

  const { latitude, longitude } = req.body;

  db.query('INSERT INTO geolocalisation_logs (latitude, longitude, timestamp) VALUES (?, ?, NOW())', 
    [latitude, longitude],
    (err, result) => {
      if (err) {
        console.error('Erreur d’enregistrement:', err);
        return res.status(500).send('Erreur serveur');
      }
      res.send('Coordonnées enregistrées');
  });
});



module.exports = router;
