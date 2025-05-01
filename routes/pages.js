const express  = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.render("login")
  });
router.get("/registre", (req, res) => {
    res.render("register")
  });
   router.get("/home", (req, res) => {
    res.render("home")
  });
  router.get("/lien", (req, res) => {
    res.render("lien")
  });
  router.get("/crea_examan", (req, res) => {
    res.render("crea_examan")
  })
  router.get("/dirict_q", (req, res) => {
    res.render("dirict_q")
  })
  router.get("/qcm_q", (req, res) => {
    res.render("qcm_q")
  })
  router.get("/exam_t", (req, res) => {
    res.render("exam_t")
  })

 

  module.exports = router;