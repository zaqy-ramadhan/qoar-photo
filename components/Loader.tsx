
import React from 'react';

const Loader = () => {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-10">
      <div className="w-16 h-16 border-4 border-t-4 border-gray-600 border-t-cyan-400 rounded-full animate-spin"></div>
      <p className="mt-4 text-lg text-cyan-300">AI is thinking...</p>
    </div>
  );
};

export default Loader;
