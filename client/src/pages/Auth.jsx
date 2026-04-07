import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";

const DISPOSABLE_DOMAINS = [
  "10minutemail.com", "temp-mail.org", "guerrillamail.com", "mailinator.com",
  "dispostable.com", "getnada.com", "dropmail.me", "tempmail.net",
  "yopmail.com", "sharklasers.com", "trbvm.com"
];

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    // 🛡️ FORM VALIDATION
    if (!isLogin) {
      if (form.password.length < 6) {
        return alert("Password must be at least 6 characters");
      }
      const domain = form.email.split("@")[1]?.toLowerCase();
      if (DISPOSABLE_DOMAINS.includes(domain)) {
        return alert("Fake/Disposable email domains are not allowed for security reasons. Please use a real email provider.");
      }
    }

    try {
      setLoading(true);
      if (isLogin) {
        const { data } = await API.post("/auth/login", {
          email: form.email,
          password: form.password,
        });
        login(data);
        navigate("/dashboard");
      } else {
        await API.post("/auth/register", form);
        // 🛡️ AFTER REGISTER -> SWITCH TO VERIFICATION
        setVerificationEmail(form.email);
        setIsVerifying(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { data } = await API.post("/auth/verify-otp", {
        email: verificationEmail,
        otp: otpCode
      });
      login(data);
      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setLoading(true);
      const { data } = await API.post("/auth/resend-otp", { 
        email: verificationEmail 
      });
      alert(data.message);
    } catch (err) {
      alert("Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#020617]">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-600/20 blur-[120px] rounded-full animate-pulse delay-700" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl">
          <AnimatePresence mode="wait">
            {isVerifying ? (
              <motion.div
                key="otp-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-2xl mx-auto mb-6 flex items-center justify-center text-blue-400 text-3xl font-bold">
                    ✉️
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Verify Email</h2>
                  <p className="text-gray-400 text-sm">
                    Enter the code we sent to <span className="text-white font-medium">{verificationEmail}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <input
                    type="text"
                    placeholder="6-Digit OTP Code"
                    className="input text-center text-2xl tracking-[10px] py-6 font-bold"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />

                  <button
                    disabled={loading}
                    className="btn primary w-full py-4 text-lg"
                  >
                    {loading ? "Verifying..." : "Confirm Verification"}
                  </button>

                  <div className="text-center">
                    <p className="text-gray-500 text-sm mb-4">Didn't receive the code?</p>
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      className="text-purple-400 font-semibold hover:text-purple-300 transition-colors"
                    >
                      Resend Code
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsVerifying(false)}
                    className="w-full text-gray-500 text-xs hover:text-gray-300 mt-4"
                  >
                    ← Back to Login
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="auth-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="text-center mb-10">
                  <motion.div 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mx-auto mb-6 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-purple-500/20"
                  >
                    S
                  </motion.div>
                  <h2 className="text-4xl font-display font-bold tracking-tight mb-2">
                    {isLogin ? "Welcome Back" : "Start Swapping"}
                  </h2>
                  <p className="text-gray-400 text-sm">
                    {isLogin ? "Enter your credentials to access your account" : "Join the world's largest skill exchange platform"}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
                  <AnimatePresence mode="wait">
                    {!isLogin && (
                      <motion.div
                        key="name"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <input
                          type="text"
                          placeholder="Full Name"
                          className="input"
                          required
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          autoComplete="off"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <input
                    type="email"
                    placeholder="Email Address"
                    className="input"
                    required
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    autoComplete="off"
                  />

                  <input
                    type="password"
                    placeholder="Password"
                    className="input"
                    required
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    autoComplete="new-password"
                  />

                  <button
                    disabled={loading}
                    className="btn primary w-full py-4 text-lg mt-4 group"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{isLogin ? "Sign In" : "Create Account"}</span>
                        <motion.span
                          animate={{ x: [0, 5, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          →
                        </motion.span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-4 my-8">
                    <div className="h-[1px] bg-white/10 flex-1" />
                    <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">Or continue with</span>
                    <div className="h-[1px] bg-white/10 flex-1" />
                  </div>

                  {/* SOCIAL BUTTONS */}
                  <div className="flex justify-center w-full transform hover:scale-[1.02] transition-transform">
                    <GoogleLogin
                      onSuccess={async (credentialResponse) => {
                        try {
                          setLoading(true);
                          const { data } = await API.post("/auth/social-login", {
                            idToken: credentialResponse.credential,
                            provider: "google"
                          });
                          login(data);
                          navigate("/dashboard");
                        } catch (err) {
                          alert("Google Login failed verification");
                        } finally {
                          setLoading(false);
                        }
                      }}
                      onError={() => {
                        alert("Google Login Failed");
                      }}
                      theme="filled_blue"
                      shape="pill"
                      width="350px"
                      text="continue_with"
                    />
                  </div>
                </form>

                <div className="mt-10 text-center">
                  <p className="text-gray-400 text-sm">
                    {isLogin ? "Don't have an account?" : "Already a member?"}
                    <button
                      onClick={() => setIsLogin(!isLogin)}
                      className="ml-2 text-purple-400 font-semibold hover:text-purple-300 transition-colors"
                    >
                      {isLogin ? "Register Now" : "Sign In Here"}
                    </button>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;