import axios from "axios";

const getBaseURL = () => {
  const url = process.env.REACT_APP_API_URL || "https://skill-swap-vuhy.onrender.com/api";
  return url.endsWith("/api") ? url : `${url}/api`;
};

const api = axios.create({
  baseURL: getBaseURL(),
});

// ================= REQUEST =================
api.interceptors.request.use((config) => {
  const userInfo = JSON.parse(localStorage.getItem("userInfo"));

  if (userInfo?.token) {
    config.headers.Authorization = `Bearer ${userInfo.token}`;
  }

  return config;
});

// ================= RESPONSE =================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log("🚨 Unauthorized → forcing logout");

      localStorage.removeItem("userInfo");

      // 🔥 HARD REDIRECT (important)
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
