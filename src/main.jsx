import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Pupil from './pupil/Pupil.jsx';
import Teacher from './teacher/Teacher.jsx';
import './styles.css';
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/teacher/*" element={<Teacher />} />
        <Route path="/*" element={<Pupil />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
