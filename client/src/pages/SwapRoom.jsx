import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";
import { FiUsers, FiMessageSquare, FiTrendingUp, FiCheckCircle, FiChevronLeft } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

// Components
import ChatSection from "../components/classroom/ChatSection";
import TaskSection from "../components/classroom/TaskSection";
import AttendanceTracker from "../components/classroom/AttendanceTracker";
import socket from "../services/socket";

const SwapRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("tasks"); // Right sidebar tabs
  const [presentUsers, setPresentUsers] = useState([]);

  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        const res = await API.get(`/rooms/${id}`);
        setData(res.data);
        
        // 🔥 Socket Join
        socket.emit("joinClassroom", { roomId: id, userId: userInfo._id });
      } catch (err) {
        alert("Error loading room: " + err.response?.data?.message);
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchRoomData();

    // 🔥 Presence updates
    socket.on("presenceUpdate", (userIds) => {
      setPresentUsers(userIds);
    });

    return () => {
      socket.emit("leaveClassroom", { roomId: id, userId: userInfo._id });
      socket.off("presenceUpdate");
    };
  }, [id, navigate, userInfo?._id]);

  const handleCompleteCourse = async () => {
    if (!window.confirm("Are you sure you want to mark this course as completed? This will update profiles for all participants.")) return;

    try {
      await API.put(`/rooms/${id}/complete`);
      alert("🎉 Course completed successfully!");
      navigate("/dashboard");
    } catch (err) {
      alert("Error completing course: " + err.response?.data?.message);
    }
  };

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-[#020617] text-white">
       <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="font-display font-medium tracking-widest uppercase text-xs animate-pulse">Entering Classroom...</p>
       </div>
    </div>
  );

  const { room, tasks, messages, attendance } = data;
  const isTeacher = room.teacher._id.toString() === userInfo._id.toString();

  return (
    <div className="h-screen flex flex-col bg-[#020617] text-white overflow-hidden font-display">
      
      {/* 🚀 NAVBAR */}
      <header className="h-20 shrink-0 glass border-b border-white/5 px-8 flex items-center justify-between z-50">
        <div className="flex items-center gap-6">
           <button onClick={() => navigate(-1)} className="p-3 glass rounded-2xl hover:bg-white/10 transition-all text-gray-400">
              <FiChevronLeft size={20} />
           </button>
           <div>
              <h2 className="text-xl font-bold tracking-tight">Skills Mastery: {room.skill}</h2>
              <div className="flex items-center gap-3">
                 <span className="text-[10px] uppercase tracking-widest font-black text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg">Swap Classroom</span>
                 <span className={`text-[10px] uppercase tracking-widest font-black ${room.status === 'active' ? 'text-green-400 bg-green-500/10' : 'text-blue-400 bg-blue-500/10'} px-2.5 py-1 rounded-lg`}>{room.status}</span>
              </div>
           </div>
        </div>

        {isTeacher && room.status === "active" && (
          <button 
            onClick={handleCompleteCourse}
            className="btn primary py-3 rounded-2xl font-bold flex items-center gap-2 group overflow-hidden"
          >
            <span className="relative z-10">Complete Course</span>
            <FiCheckCircle size={20} className="relative z-10 group-hover:scale-110 transition-transform" />
          </button>
        )}
      </header>

      {/* 🏗️ MAIN CONTENT AREA */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        
        {/* 👤 LEFT SIDEBAR: PARTICIPANTS */}
        <aside className="w-80 shrink-0 flex flex-col gap-6 overflow-y-auto">
          <div className="glass p-6 rounded-[2.5rem] border border-white/10 flex-1">
             <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400"><FiUsers size={20}/></div>
                <h3 className="font-bold tracking-tight">Class Roster</h3>
             </div>

             <div className="space-y-8">
                {/* TEACHER */}
                <div>
                   <p className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-4">Instructor</p>
                   <div className="flex items-center gap-4 bg-white/5 p-4 rounded-[2rem] border border-white/5 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative">
                         <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-lg font-bold border border-white/10 shadow-lg shrink-0">
                            {room.teacher.name[0]}
                         </div>
                         {presentUsers.includes(room.teacher._id) && (
                           <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-[#020617] shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                         )}
                      </div>
                      <div className="overflow-hidden">
                         <p className="font-bold tracking-tight text-gray-100 truncate">{room.teacher.name}</p>
                         <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest truncate">{room.skill} Master</p>
                      </div>
                   </div>
                </div>

                {/* STUDENTS */}
                <div>
                   <p className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-4">Learners ({room.students.length})</p>
                   <div className="space-y-3">
                      {room.students.map((student) => (
                        <div key={student._id} className="flex items-center gap-4 p-4 rounded-3xl hover:bg-white/5 transition-all cursor-default border border-transparent hover:border-white/5">
                           <div className="relative">
                              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-sm font-bold border border-white/10 shadow-lg shrink-0">
                                 {student.name[0]}
                              </div>
                              {presentUsers.includes(student._id) && (
                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-[3px] border-[#020617] shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                              )}
                           </div>
                           <div className="overflow-hidden">
                              <p className="font-bold tracking-tight text-gray-100 truncate">{student.name}</p>
                              <div className="flex items-center gap-1.5 grayscale transition-all hover:grayscale-0">
                                 {student.skillsOffered?.slice(0, 1).map(s => <span key={s} className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase">{s}</span>)}
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        </aside>

        {/* 💬 CENTER: CHAT */}
        <section className="flex-1 min-w-0">
          <ChatSection roomId={room._id} initialMessages={messages} />
        </section>

        {/* 📊 RIGHT SIDEBAR: TASKS & ATTENDANCE */}
        <aside className="w-96 shrink-0 flex flex-col gap-6">
           <div className="glass p-2 rounded-3xl border border-white/10 flex gap-1">
              <button 
                onClick={() => setActiveTab("tasks")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'tasks' ? 'bg-purple-600 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              >
                <FiTrendingUp size={16} /> Goals
              </button>
              <button 
                onClick={() => setActiveTab("attendance")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'attendance' ? 'bg-purple-600 text-white shadow-xl' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              >
                <FiMessageSquare size={16} /> Attendance
              </button>
           </div>
           
           <div className="flex-1 min-h-0">
              <AnimatePresence mode="wait">
                 {activeTab === "tasks" ? (
                   <motion.div 
                    key="tasks"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                   >
                      <TaskSection 
                        roomId={room._id} 
                        tasks={tasks} 
                        isTeacher={isTeacher} 
                        students={room.students} 
                      />
                   </motion.div>
                 ) : (
                   <motion.div 
                    key="attendance"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                   >
                      <AttendanceTracker 
                        roomId={room._id} 
                        initialAttendance={attendance} 
                        isTeacher={isTeacher} 
                        students={room.students} 
                      />
                   </motion.div>
                 )}
              </AnimatePresence>
           </div>
        </aside>

      </main>
    </div>
  );
};

export default SwapRoom;
