import React, { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  title: string;
}

const Modal: React.FC<ModalProps> = ({ onClose, children, title }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="relative z-[9999]" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Background backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-fade-in" 
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Fixed-position overlay for the modal itself */}
      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          {/* Modal panel */}
          <div 
            className="relative transform overflow-hidden rounded-xl bg-gray-800 text-left shadow-2xl transition-all sm:my-8 w-full max-w-md animate-fade-in border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-800/50">
                <h3 className="text-xl font-bold leading-6 text-yellow-400 truncate pr-4" id="modal-title">
                {title}
                </h3>
                <button
                    onClick={onClose}
                    type="button"
                    className="rounded-md bg-transparent text-gray-400 hover:text-white focus:outline-none transition-colors"
                    aria-label="Close"
                >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            {/* Content */}
            <div className="px-6 py-6 max-h-[80vh] overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;