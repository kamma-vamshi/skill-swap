import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { FiArrowUpRight, FiArrowDownLeft, FiCheck, FiX, FiRefreshCw, FiStar } from "react-icons/fi";
import socket from "../services/socket";

const SwapRequests = () => {
  const { userInfo, loading } = useAuth();
  const [swaps, setSwaps] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeTab, setActiveTab] = useState("received");
  const [reviewingSwap, setReviewingSwap] = useState(null);

  useEffect(() => {
    if (!userInfo?._id) return;

    socket.emit("join", userInfo._id);

    socket.on("swap_request", (newSwap) => {
      setSwaps((prev) => [newSwap, ...prev]);
      toast.success("New Swap Request! 📥");
    });

    socket.on("swap_update", ({ swap, message }) => {
      setSwaps((prev) =>
        prev.map((s) => (s._id === swap._id ? swap : s))
      );
      toast(message || "Swap updated! ✨", { icon: 'ℹ️' });
    });

    return () => {
      socket.off("swap_request");
      socket.off("swap_update");
    };
  }, [userInfo]);

  const fetchSwaps = async () => {
    try {
      setActionLoading("fetching");
      const { data } = await API.get("/swaps");
      setSwaps(data || []);
    } catch (err) {
      toast.error("Failed to fetch requests");
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (userInfo?._id) {
      fetchSwaps();
    }
  }, [userInfo]);

  const compareIds = (id1, id2) => {
    if (!id1 || !id2) return false;
    const s1 = (typeof id1 === 'string' ? id1 : id1._id?.toString() || id1.toString()).toLowerCase();
    const s2 = (typeof id2 === 'string' ? id2 : id2._id?.toString() || id2.toString()).toLowerCase();
    return s1 === s2;
  };

  const handleSwapAction = async (id, status) => {
    try {
      setActionLoading(id);
      await API.put(`/swaps/${id}`, { status });
      toast.success(`Request ${status}`);
      fetchSwaps();
    } catch (err) {
      toast.error(err.response?.data?.message || "Error");
    } finally {
      setActionLoading(null);
    }
  };

  const received = swaps.filter((s) => compareIds(s.receiver, userInfo));
  const sent = swaps.filter((s) => compareIds(s.sender, userInfo));

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto pb-20 pt-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">
              Swap <span className="gradient-text">Requests</span>
            </h1>
            <p className="text-gray-400">
              Manage your incoming and outgoing skill swap proposals.
            </p>
          </div>
          
          <button 
            onClick={fetchSwaps}
            disabled={actionLoading === "fetching"}
            className="btn outline border-white/10 flex items-center gap-2"
          >
            <FiRefreshCw className={actionLoading === "fetching" ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-4 mb-8 bg-white/5 p-1.5 rounded-2xl w-fit border border-white/5">
          <button
            onClick={() => setActiveTab("received")}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
              activeTab === "received" 
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FiArrowDownLeft /> Received
            <span className="bg-white/10 px-2 py-0.5 rounded-md text-[10px] ml-1">{received.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
              activeTab === "sent" 
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FiArrowUpRight /> Sent
            <span className="bg-white/10 px-2 py-0.5 rounded-md text-[10px] ml-1">{sent.length}</span>
          </button>
        </div>

        {/* CONTENT */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: activeTab === "received" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeTab === "received" ? 20 : -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {(activeTab === "received" ? received : sent).map((swap) => (
              <SwapCard 
                key={swap._id} 
                swap={swap} 
                isReceived={activeTab === "received"} 
                onAction={handleSwapAction}
                actionLoading={actionLoading}
                setReviewingSwap={setReviewingSwap}
              />
            ))}
            {(activeTab === "received" ? received : sent).length === 0 && (
              <div className="col-span-full py-20 card flex flex-col items-center justify-center text-center opacity-50">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-2xl mb-4 border border-white/5">
                  {activeTab === "received" ? <FiArrowDownLeft /> : <FiArrowUpRight />}
                </div>
                <p className="font-medium">No {activeTab} requests found.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* REVIEW MODAL */}
        <AnimatePresence>
          {reviewingSwap && (
            <ReviewModal 
              swap={reviewingSwap} 
              onClose={() => setReviewingSwap(null)} 
              onSuccess={() => {
                setReviewingSwap(null);
                fetchSwaps();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};

const SwapCard = ({ swap, isReceived, onAction, actionLoading, setReviewingSwap }) => {
  const otherUser = isReceived ? swap.sender : swap.receiver;

  return (
    <div className="card flex flex-col justify-between group overflow-hidden">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center font-bold text-white border border-white/10">
            {otherUser?.name?.[0]}
          </div>
          <div>
            <h4 className="font-bold leading-none mb-1">{isReceived ? otherUser?.name : `To ${otherUser?.name}`}</h4>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              {new Date(swap.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <Status status={swap.status} />
      </div>

      <div className="space-y-4 mb-8">
        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
            Skill {isReceived ? "Requested" : "Offered"}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-glow shadow-green-500/50" />
            <span className="font-bold text-gray-200">{swap.skillOffered}</span>
          </div>
        </div>

        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
            Skill {isReceived ? "Offered" : "Target"}
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-glow shadow-yellow-500/50" />
            <span className="font-bold text-gray-200">{swap.skillRequested}</span>
          </div>
        </div>
      </div>

      {isReceived && swap.status === "pending" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onAction(swap._id, "accepted")}
            disabled={actionLoading === swap._id}
            className="btn primary py-2.5 text-xs flex items-center justify-center gap-2 shadow-none"
          >
            <FiCheck /> Accept
          </button>
          <button
            onClick={() => onAction(swap._id, "rejected")}
            disabled={actionLoading === swap._id}
            className="btn outline py-2.5 text-xs flex items-center justify-center gap-2 border-red-500/20 text-red-400 hover:bg-red-500/10"
          >
            <FiX /> Reject
          </button>
        </div>
      )}

      {swap.status === "accepted" && (
        <div className="space-y-3 w-full">
           <button
             onClick={() => window.location.href = `/swap-room/${swap.classroom}`}
             className="btn primary w-full py-2.5 text-xs flex items-center justify-center gap-2"
           >
             <FiRefreshCw className="animate-spin-slow" /> Open Classroom
           </button>
           <button
             onClick={() => onAction(swap._id, "completed")}
             disabled={actionLoading === swap._id}
             className="btn outline w-full py-2.5 text-xs flex items-center justify-center gap-2 border-green-500/20 text-green-400 hover:bg-green-500/10"
           >
             <FiCheck /> Mark as Completed
           </button>
        </div>
      )}

      {swap.status === "completed" && (
        <button
          onClick={() => setReviewingSwap(swap)}
          className="btn primary w-full py-2.5 text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 border-none"
        >
          <FiStar /> Leave Review
        </button>
      )}
    </div>
  );
};

const Status = ({ status }) => (
  <span className={`status ${status}`}>
    {status}
  </span>
);

const ReviewModal = ({ swap, onClose, onSuccess }) => {
  const { userInfo } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Review the OTHER person
  const reviewedUser = swap.sender._id === userInfo._id ? swap.receiver : swap.sender;

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await API.post("/reviews", {
        reviewedUser: reviewedUser._id,
        swapId: swap._id,
        rating,
        comment,
      });
      toast.success("Review submitted! ⭐");
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || "Already reviewed");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="glass w-full max-w-md p-8 rounded-3xl border border-white/10 shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors">
          <FiX size={24} />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-display font-bold mb-2">Leave a Review</h2>
          <p className="text-gray-400 text-sm">How was your swap experience with {reviewedUser.name}?</p>
        </div>

        <div className="flex justify-center gap-3 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="group transition-transform active:scale-95"
            >
              <FiStar 
                size={32} 
                className={`transition-all duration-300 ${
                  star <= rating 
                    ? "text-yellow-500 fill-yellow-500 shadow-glow" 
                    : "text-gray-600 hover:text-gray-400"
                }`}
              />
            </button>
          ))}
        </div>

        <div className="space-y-4 mb-8">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block pl-2">
            Comments (Optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors h-32 resize-none"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn primary w-full py-4 text-sm font-bold shadow-lg shadow-purple-500/20"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Submit Feedback"
          )}
        </button>
      </motion.div>
    </div>
  );
};

export default SwapRequests;
