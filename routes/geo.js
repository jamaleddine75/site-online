const express = require("express");
const router = express.Router();

const mysql = require("mysql");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const db = mysql.createConnection({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE,
});


router.post("/save-coordinates", (req, res) => {
  const { latitude, longitude } = req.body;

  db.query(
    "INSERT INTO geolocalisation_logs (latitude, longitude, timestamp) VALUES (?, ?, NOW())",
    [latitude, longitude],
    (err, result) => {
      if (err) {
        console.error("Erreur d’enregistrement:", err);
        return res.status(500).send("Erreur serveur");
      }
      res.json({ message: "Coordonnées enregistrées" });
    }
  );
});

module.exports = router;
