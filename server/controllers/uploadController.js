import Message from "../models/Message.js";

// 📤 Upload File Controller
export const uploadFile = async (req, res) => {
  try {
    // 🔐 Check file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const { sender, receiver } = req.body;

    // 📎 Cloudinary URL
    const fileUrl = req.file.path;

    // 💬 Save as message
    const message = await Message.create({
      sender,
      receiver,
      image: fileUrl,
      status: "sent",
    });

    res.status(200).json({
      success: true,
      image: message.image,
      message: "File uploaded successfully",
    });

  } catch (error) {
    console.error("Upload Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Upload failed",
    });
  }
};