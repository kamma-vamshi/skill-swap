import { useState, useEffect } from "react";
import API from "../../services/api";
import socket from "../../services/socket";
import { FiPlus, FiCheckCircle, FiClock, FiUser, FiInfo } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const TaskSection = ({ roomId, tasks: initialTasks, isTeacher, students }) => {
  const [tasks, setTasks] = useState(initialTasks || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assignedTo: students[0]?._id || "",
    dueDate: "",
  });

  // 🔥 Real-time listeners
  useEffect(() => {
    socket.on("taskAssigned", (task) => {
      if (task.roomId === roomId) {
        setTasks((prev) => [task, ...prev]);
      }
    });

    socket.on("taskUpdated", (task) => {
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? task : t))
      );
    });

    return () => {
      socket.off("taskAssigned");
      socket.off("taskUpdated");
    };
  }, [roomId]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/rooms/tasks", {
        roomId,
        ...newTask,
      });
      setTasks((prev) => [res.data, ...prev]);
      setShowAddForm(false);
      setNewTask({ title: "", description: "", assignedTo: students[0]?._id || "", dueDate: "" });
    } catch (err) {
      alert("Error adding task: " + err.response?.data?.message);
    }
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    try {
      const newStatus = currentStatus === "pending" ? "completed" : "pending";
      await API.put(`/rooms/tasks/${taskId}`, { status: newStatus });
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      alert("Error updating task: " + err.response?.data?.message);
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-3xl p-6 border border-white/10 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
           <h3 className="font-display font-bold text-xl tracking-tight">Daily Goals</h3>
           <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mt-1">Task Tracker</p>
        </div>
        {isTeacher && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-3 bg-purple-600 rounded-2xl hover:bg-purple-500 transition-all shadow-lg active:scale-95"
          >
            <FiPlus size={20} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddTask}
            className="mb-8 space-y-4 glass bg-white/5 p-6 rounded-3xl border border-white/10 overflow-hidden"
          >
            <input
              type="text"
              placeholder="Task Title"
              required
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none font-medium"
            />
            <textarea
              placeholder="Description (Optional)"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl h-24 focus:ring-2 focus:ring-purple-500/50 outline-none font-medium"
            />
            <div className="grid grid-cols-2 gap-4">
              <select
                value={newTask.assignedTo}
                onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                className="bg-gray-800 text-white border border-white/10 p-4 rounded-xl outline-none"
              >
                {students.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="bg-white/5 border border-white/10 p-4 rounded-xl focus:ring-2 focus:ring-purple-500/50 outline-none text-gray-300"
              />
            </div>
            <button className="btn primary w-full py-4 rounded-2xl shadow-xl">Assign Goal</button>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {tasks.map((task) => (
          <motion.div
            key={task._id}
            layout
            className={`p-6 rounded-[2rem] border transition-all ${
              task.status === "completed"
                ? "bg-green-500/5 border-green-500/10 opacity-60 grayscale-[0.3]"
                : "glass border-white/10 hover:border-white/20"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                   <h4 className={`text-lg font-bold tracking-tight ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-100'}`}>
                      {task.title}
                   </h4>
                   {task.status === 'completed' && <FiCheckCircle className="text-green-500" size={18} />}
                   {task.status === 'pending' && <FiClock className="text-yellow-500" size={18} />}
                </div>
                {task.description && (
                  <p className="text-sm text-gray-400 font-medium mb-4">{task.description}</p>
                )}
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-gray-500">
                    <FiUser size={12} className="text-purple-500" />
                    Assigned To: {students.find(s => s._id === task.assignedTo)?.name || 'Member'}
                  </div>
                  {task.dueDate && (
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-red-400 bg-red-400/5 px-2 py-1 rounded-lg">
                      <FiClock size={12} />
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => toggleTaskStatus(task._id, task.status)}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  task.status === "completed"
                    ? "bg-green-500 text-white shadow-lg"
                    : "glass border-white/20 hover:bg-white/10 text-gray-400"
                }`}
              >
                <FiCheckCircle size={24} />
              </button>
            </div>
          </motion.div>
        ))}
        {tasks.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 mt-20">
             <FiInfo size={48} className="mb-4" />
             <p className="font-bold tracking-tight">No goals assigned yet.</p>
             <p className="text-xs uppercase tracking-widest font-black">Focus on your conversation for now.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskSection;
