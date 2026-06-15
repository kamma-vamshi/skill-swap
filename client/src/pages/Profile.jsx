import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { FiSave, FiPlus, FiX, FiUser, FiMail, FiZap, FiStar, FiMessageCircle } from "react-icons/fi";

const Profile = () => {
  const { userInfo, login } = useAuth();
  
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [skillsOffered, setSkillsOffered] = useState([]);
  const [skillsWanted, setSkillsWanted] = useState([]);
  const [skillsLearned, setSkillsLearned] = useState([]);
  const [skillsTaught, setSkillsTaught] = useState([]);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [newSkillOffered, setNewSkillOffered] = useState("");
  const [newSkillWanted, setNewSkillWanted] = useState("");
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    try {
      setReviewsLoading(true);
      const { data } = await API.get(`/reviews/${userInfo._id}`);
      setReviews(data);
    } catch (err) {
      console.error("Error fetching reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  }, [userInfo?._id]);

  useEffect(() => {
    if (userInfo) {
      setName(userInfo.name || "");
      setBio(userInfo.bio || "");
      setProfilePic(userInfo.profilePic || "");
      setSkillsOffered(userInfo.skillsOffered || []);
      setSkillsWanted(userInfo.skillsWanted || []);
      setSkillsLearned(userInfo.skillsLearned || []);
      setSkillsTaught(userInfo.skillsTaught || []);
      setCompletedSessions(userInfo.completedSessions || 0);
      fetchReviews();
    }
  }, [userInfo, fetchReviews]);

  const addSkill = (type) => {
    if (type === "offered" && newSkillOffered.trim()) {
      setSkillsOffered([...skillsOffered, newSkillOffered.trim()]);
      setNewSkillOffered("");
    }
    if (type === "wanted" && newSkillWanted.trim()) {
      setSkillsWanted([...skillsWanted, newSkillWanted.trim()]);
      setNewSkillWanted("");
    }
  };

  const removeSkill = (type, index) => {
    if (type === "offered") {
      setSkillsOffered(skillsOffered.filter((_, i) => i !== index));
    } else {
      setSkillsWanted(skillsWanted.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const { data } = await API.put("/users/profile", {
        name,
        bio,
        profilePic,
        skillsOffered,
        skillsWanted,
      });
      
      // Update local storage/context
      const updatedUser = { ...userInfo, ...data };
      login(updatedUser);
      toast.success("Profile updated successfully! ✨");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto pb-20 pt-10">
        {/* HEADER */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-display font-bold mb-2">
            My <span className="gradient-text">Profile</span>
          </h1>
          <p className="text-gray-400">
            Customize your identity and skills on the network.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* PROFILE CARD */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4"
          >
            <div className="card text-center flex flex-col items-center">
              <div className="relative group mb-6">
                <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-5xl font-bold text-white border-2 border-white/5 group-hover:scale-105 transition-transform duration-500">
                  {name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center border-4 border-[#020617] text-white shadow-xl">
                  <FiZap size={16} />
                </div>
              </div>

              <h2 className="text-2xl font-display font-bold mb-1">{name || "Your Name"}</h2>
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-8">
                <FiMail size={14} />
                {userInfo?.email}
              </div>

              <div className="w-full pt-6 border-t border-white/5 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Skills Shared</span>
                  <span className="font-bold text-purple-400">{skillsOffered.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Skills Seeking</span>
                  <span className="font-bold text-pink-400">{skillsWanted.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                   <span className="text-gray-500">Courses Completed</span>
                   <span className="font-bold text-green-400">{completedSessions}</span>
                </div>
              </div>

              {/* ⭐ RATING SUMMARY */}
              <div className="w-full pt-6 mt-6 border-t border-white/5">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FiStar 
                        key={star} 
                        size={18} 
                        className={star <= Math.round(userInfo?.averageRating || 0) ? "text-yellow-500 fill-yellow-500 shadow-glow" : "text-gray-600"} 
                      />
                    ))}
                  </div>
                  <p className="text-sm font-bold text-gray-200">
                    {userInfo?.averageRating ? userInfo.averageRating.toFixed(1) : "0.0"} / 5.0
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    Based on {userInfo?.totalReviews || 0} reviews
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* EDIT FLOW */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-8 space-y-8"
          >
            {/* NAME SETTING */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block flex items-center gap-2">
                    <FiUser className="text-purple-500" /> Display Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="How others will see you"
                    className="input"
                  />
                </div>
                <div className="card">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block flex items-center gap-2">
                    <FiMail className="text-blue-500" /> Bio / Tagline
                  </label>
                  <input
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Short description of yourself"
                    className="input"
                  />
                </div>
            </div>

            {/* MASTERY SECTION */}
            {(skillsLearned.length > 0 || skillsTaught.length > 0) && (
              <div className="card bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
                <h3 className="text-sm font-bold uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                   <FiZap className="fill-indigo-500/20" /> Your Mastery Achievements
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {skillsLearned.length > 0 && (
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-tighter text-gray-500 mb-3">Skills Learned</p>
                        <div className="flex flex-wrap gap-2">
                           {skillsLearned.map(s => <span key={s} className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-bold rounded-lg border border-green-500/20">{s}</span>)}
                        </div>
                     </div>
                   )}
                   {skillsTaught.length > 0 && (
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-tighter text-gray-500 mb-3">Skills Taught</p>
                        <div className="flex flex-wrap gap-2">
                           {skillsTaught.map(s => <span key={s} className="px-3 py-1 bg-purple-500/10 text-purple-400 text-xs font-bold rounded-lg border border-purple-500/20">{s}</span>)}
                        </div>
                     </div>
                   )}
                </div>
              </div>
            )}

            {/* SKILLS OFFERED */}
            <div className="card">
              <label className="text-xs font-bold text-green-500 uppercase tracking-widest mb-4 block flex items-center gap-2">
                <FiZap className="fill-green-500/20" /> Skills You Offer
              </label>

              <div className="flex flex-wrap gap-2 mb-6">
                {skillsOffered.map((skill, i) => (
                  <span key={i} className="chip green flex items-center gap-2 pr-2">
                    {skill}
                    <button 
                      onClick={() => removeSkill("offered", i)}
                      className="hover:text-white transition-colors"
                    >
                      <FiX size={12} />
                    </button>
                  </span>
                ))}
                {skillsOffered.length === 0 && <p className="text-sm text-gray-600">No skills added yet.</p>}
              </div>

              <div className="flex gap-3">
                <input
                  value={newSkillOffered}
                  onChange={(e) => setNewSkillOffered(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSkill("offered")}
                  placeholder="e.g. JavaScript, Design..."
                  className="input flex-1"
                />
                <button
                  onClick={() => addSkill("offered")}
                  className="btn outline border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white"
                >
                  <FiPlus size={20} />
                </button>
              </div>
            </div>

            {/* SKILLS WANTED */}
            <div className="card">
              <label className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-4 block flex items-center gap-2">
                <FiZap className="fill-yellow-500/20" /> Skills You Want
              </label>

              <div className="flex flex-wrap gap-2 mb-6">
                {skillsWanted.map((skill, i) => (
                  <span key={i} className="chip yellow flex items-center gap-2 pr-2">
                    {skill}
                    <button 
                      onClick={() => removeSkill("wanted", i)}
                      className="hover:text-white transition-colors"
                    >
                      <FiX size={12} />
                    </button>
                  </span>
                ))}
                {skillsWanted.length === 0 && <p className="text-sm text-gray-600">No skills added yet.</p>}
              </div>

              <div className="flex gap-3">
                <input
                  value={newSkillWanted}
                  onChange={(e) => setNewSkillWanted(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSkill("wanted")}
                  placeholder="e.g. Piano, French..."
                  className="input flex-1"
                />
                <button
                  onClick={() => addSkill("wanted")}
                  className="btn outline border-yellow-500/30 text-yellow-400 hover:bg-yellow-500 hover:text-white"
                >
                  <FiPlus size={20} />
                </button>
              </div>
            </div>

            {/* SAVE BUTTON */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn primary w-full py-4 text-lg shadow-xl shadow-purple-500/10"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FiSave size={20} />
                  <span>Update Profile</span>
                </>
              )}
            </button>

            {/* REVIEWS SECTION */}
            <div className="pt-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-xl text-yellow-500">
                  <FiMessageCircle />
                </div>
                <h2 className="text-2xl font-display font-bold tracking-tight">Recent Feedback</h2>
              </div>

              {reviewsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="card text-center py-12 border-dashed border-white/10">
                  <p className="text-gray-500 font-medium italic">No reviews yet. Complete your first swap to get feedback!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {reviews.map((review) => (
                    <div key={review._id} className="card p-6 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-purple-400">
                              {review.reviewer?.name?.[0] || "?"}
                            </div>
                            <div>
                              <p className="text-sm font-bold">{review.reviewer?.name || "Deleted User"}</p>
                              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                                {new Date(review.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <FiStar size={12} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-xs font-bold text-gray-200">{review.rating}</span>
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm italic leading-relaxed">
                          "{review.comment || "No comment provided."}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
