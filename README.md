# 🚀 SkillSwap - Peer-to-Peer Learning Platform

SkillSwap is a secure, real-time platform where users exchange skills (like React for Photoshop) without money. It features secure OAuth2 authentication, intelligent skill matching, and live collaboration rooms.

## ✨ Features
- **Secure Auth**: Google Login (OAuth2) + Email OTP Verification.
- **Marketplace**: Search and discover skilled users nearby.
- **Real-Time Swaps**: "Swap Rooms" with integrated Chat and Task tracking (WebSockets).
- **Security First**: Protected against NoSQL Injection, XSS, and Disposable Emails.

## 🛠️ Tech Stack
- **Frontend**: React, Tailwind CSS, Framer Motion.
- **Backend**: Node.js, Express, MongoDB, Socket.io.
- **Support**: Cloudinary (Images), Nodemailer (OTP).

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas account.
- Google Cloud Project (for Auth).

### 2. Installation
Clone the repository and install dependencies in both folders:

```bash
# Server setup
cd server
npm install

# Client setup
cd client
npm install
```

### 3. Environment Setup
Create `.env` files in both `client/` and `server/` using the `.env.example` templates.

### 4. Running the App
```bash
# In /server
npm start

# In /client
npm start
```

## 🤝 Contributing
Welcome to the SkillSwap team! This project is built for collaboration. 

---
© 2026 SkillSwap Team
