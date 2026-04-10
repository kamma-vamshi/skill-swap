import { motion } from "framer-motion";
import { FiStar } from "react-icons/fi";

const Chip = ({ children, color }) => (
  <span className={`chip ${color}`}>
    {children}
  </span>
);

const UserCard = ({ user, toggleFavorite, favorites }) => {
  const isFav = favorites.some((f) => f._id === user._id);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="glass-premium p-6 rounded-[2.5rem] flex flex-col items-center text-center group border border-white/5 transition-all duration-500 hover:border-purple-500/30 relative overflow-hidden"
    >
      {/* 🔮 Background Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full group-hover:bg-purple-500/20 transition-all duration-500" />
      
      {/* 👤 Avatar */}
      <div className="relative mb-5">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
        <div className="w-24 h-24 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-[2rem] flex items-center justify-center text-4xl font-black border border-white/10 relative z-10 group-hover:scale-110 transition-transform duration-700">
          <img 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} 
            alt={user.name} 
            className="w-20 h-20"
          />
        </div>
      </div>

      {/* 📝 User Info */}
      <h3 className="font-display font-black text-xl mb-1 group-hover:text-purple-400 transition-colors duration-300">
        {user.name}
      </h3>
      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-3">{user.email}</p>
      
      {/* ⭐ Rating Badge */}
      <div className="flex items-center gap-2 mb-6 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 shadow-inner">
        <FiStar className="text-yellow-500 fill-yellow-500" size={12} />
        <span className="text-xs font-black text-gray-200">
          {user.averageRating ? user.averageRating.toFixed(1) : "NEW"}
        </span>
        <div className="w-1 h-1 bg-white/10 rounded-full" />
        <span className="text-[10px] text-gray-500 font-black">
          {user.totalReviews || 0} REVIEWS
        </span>
      </div>

      {/* ⚡ Skills */}
      <div className="mt-auto w-full">
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {user.skillsOffered?.slice(0, 3).map((s, i) => (
            <Chip key={i} color="green">
              {s}
            </Chip>
          ))}
          {user.skillsOffered?.length > 3 && (
            <span className="text-[9px] text-gray-600 font-black uppercase tracking-tighter">+{user.skillsOffered.length - 3} More</span>
          )}
        </div>

        {/* 💖 Favorite Button */}
        <button
          onClick={() => toggleFavorite(user)}
          className={`w-full btn ${isFav ? 'bg-red-500/20 text-red-400 border-red-500/20' : 'glass hover:bg-white/5'} py-3 text-[11px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 border transition-all duration-300 active:scale-95`}
        >
          <FiStar className={`${isFav ? 'fill-current' : ''} transition-transform duration-300 ${isFav ? 'scale-110' : ''}`} />
          {isFav ? "Saved to List" : "Add to Favorites"}
        </button>
      </div>
    </motion.div>
  );
};

export default UserCard;
