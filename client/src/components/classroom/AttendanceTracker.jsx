import { useState, useEffect } from "react";
import API from "../../services/api";
import socket from "../../services/socket";
import { FiCheck, FiX, FiInfo } from "react-icons/fi";
import { motion } from "framer-motion";

const AttendanceTracker = ({ roomId, initialAttendance, isTeacher, students }) => {
  const [attendance, setAttendance] = useState(initialAttendance || []);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  // 🔥 Real-time listener
  useEffect(() => {
    socket.on("attendanceUpdated", (record) => {
      if (record.roomId === roomId) {
        setAttendance((prev) => {
          const filtered = prev.filter((a) => !(a.userId === record.userId && a.date === record.date));
          return [...filtered, record];
        });
      }
    });
    return () => {
      socket.off("attendanceUpdated");
    };
  }, [roomId]);

  const markStatus = async (userId, status) => {
    try {
      const res = await API.post("/rooms/attendance", {
        roomId,
        userId,
        date: selectedDate,
        status,
      });
      setAttendance((prev) => {
        const filtered = prev.filter((a) => !(a.userId === userId && a.date === selectedDate));
        return [...filtered, res.data];
      });
    } catch (err) {
      alert("Error marking attendance: " + err.response?.data?.message);
    }
  };

  const currentDayAttendance = (userId) => {
    return attendance.find((a) => (a.userId?._id || a.userId) === userId && a.date === selectedDate);
  };

  return (
    <div className="flex flex-col h-full glass rounded-3xl p-6 border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
           <h3 className="font-display font-bold text-xl tracking-tight">Attendance</h3>
           <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mt-1">Presence Log</p>
        </div>
        <div className="relative">
           <input
             type="date"
             value={selectedDate}
             onChange={(e) => setSelectedDate(e.target.value)}
             className="bg-purple-600/20 border border-purple-500/30 rounded-xl px-4 py-2 text-xs font-bold text-purple-400 outline-none"
           />
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto custom-scrollbar">
        {students.map((student) => {
          const record = currentDayAttendance(student._id);
          return (
            <motion.div
              key={student._id}
              layout
              className="p-4 rounded-3xl glass border border-white/10 flex items-center justify-between hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-sm font-bold border border-white/10 shadow-lg">
                    {student.name[0]}
                 </div>
                 <div>
                    <p className="text-sm font-bold tracking-tight text-gray-100">{student.name}</p>
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-500">Learner</p>
                 </div>
              </div>

              <div className="flex items-center gap-2">
                {isTeacher ? (
                  <>
                    <button
                      onClick={() => markStatus(student._id, "present")}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        record?.status === "present"
                          ? "bg-green-600 text-white shadow-lg"
                          : "glass border border-green-500/20 text-green-500/50 hover:bg-green-500/10"
                      }`}
                    >
                      <FiCheck size={18} />
                    </button>
                    <button
                      onClick={() => markStatus(student._id, "absent")}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                        record?.status === "absent"
                          ? "bg-red-600 text-white shadow-lg"
                          : "glass border border-red-500/20 text-red-500/50 hover:bg-red-500/10"
                      }`}
                    >
                      <FiX size={18} />
                    </button>
                  </>
                ) : (
                  <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${
                    record?.status === "present" ? "bg-green-500/20 text-green-500" : record?.status === "absent" ? "bg-red-500/20 text-red-500" : "bg-white/5 text-gray-500"
                  }`}>
                    {record?.status || "No Record"}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
        {students.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center opacity-30 mt-20">
             <FiInfo size={48} className="mb-4" />
             <p className="font-bold tracking-tight">No participants logged.</p>
          </div>
        )}
      </div>

      <div className="mt-auto pt-6 border-t border-white/5">
         <div className="p-4 glass bg-blue-500/5 rounded-2xl border border-blue-500/10">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Session Insights</h4>
            <p className="text-xs font-medium text-gray-400 leading-relaxed">
               Success rate is measured by consistent presence. Keep the streak alive!
            </p>
         </div>
      </div>
    </div>
  );
};

export default AttendanceTracker;
