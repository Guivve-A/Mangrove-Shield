const express = require("express");
const { asyncHandler } = require("../utils/errors");
const { getWeatherNow } = require("../controllers/weatherController");

const router = express.Router();

router.get("/now", asyncHandler(getWeatherNow));

module.exports = router;