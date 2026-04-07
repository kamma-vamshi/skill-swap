import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";

const Layout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      
      {/* SIDEBAR */}
      <Sidebar />

      {/* RIGHT SIDE */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* NAVBAR */}
        <Navbar />

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pt-20 md:pt-24 pb-28 lg:pb-6 custom-scrollbar">
          {children}
        </main>

        {/* MOBILE BOTTOM NAV */}
        <BottomNav />

      </div>
    </div>
  );
};

export default Layout;
