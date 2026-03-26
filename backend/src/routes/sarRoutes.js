const express = require("express");
const { asyncHandler } = require("../utils/errors");
const { getScenes, getWaterMask } = require("../controllers/sarController");

const router = express.Router();

router.get("/scenes", asyncHandler(getScenes));
router.get("/water-mask", asyncHandler(getWaterMask));

module.exports = router;