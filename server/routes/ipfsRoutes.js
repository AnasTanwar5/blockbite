const express = require("express");
const multer = require("multer");
const { uploadJSONToIPFS } = require("../utils/ipfs");

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 1. Upload JSON Metadata to IPFS
router.post("/json", async (req, res) => {
  try {
    const result = await uploadJSONToIPFS(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Upload File/Image metadata representation to IPFS
router.post("/file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    const fileMeta = {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      base64Sample: req.file.buffer.toString("base64").substring(0, 100),
      timestamp: new Date().toISOString(),
    };

    const result = await uploadJSONToIPFS(fileMeta);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
