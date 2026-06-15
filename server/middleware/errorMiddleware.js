// 🔥 Global Error Handler Middleware

const errorHandler = (err, req, res, next) => {
  console.error("❌ ERROR:", err.message);

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Server Error",
    
    // 👇 show stack only in dev
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

export default errorHandler;
