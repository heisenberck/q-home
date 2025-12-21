
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 h-7 flex items-center px-6 flex-shrink-0 z-40">
      <div className="w-full flex justify-between items-center">
        <p className="text-[10px] font-medium text-gray-400">
          © {new Date().getFullYear()} Q-Home Manager. Hệ thống quản lý tòa nhà thông minh.
        </p>
        {/* Phía bên phải để trống để ResidentsPage overlay phần phân trang vào */}
        <div id="footer-pagination-zone"></div>
      </div>
    </footer>
  );
};

export default Footer;