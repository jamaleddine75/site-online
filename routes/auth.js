const express  = require("express");
const authcontroller = require('../controullers/auth');

const router = express.Router();

router.post("/register",authcontroller.register);

router.post("/login",authcontroller.login);
router.post("/crea_examan",authcontroller.crea_examan);

router.post("/dirict_q",authcontroller.dirict_q);
router.post("/qcm_q",authcontroller.qcm_q);

module.exports = router;