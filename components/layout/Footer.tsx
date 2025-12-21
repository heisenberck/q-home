import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 h-12 flex items-center px-6 flex-shrink-0">
      <div className="w-full flex justify-between items-center">
        <p className="text-[10px] md:text-xs text-gray-400 font-medium italic">
          © {new Date().getFullYear()} Q-Home Manager. Hệ thống quản lý vận hành thông minh.
        </p>
      </div>
    </footer>
  );
};

export default Footer;