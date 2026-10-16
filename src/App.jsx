import React from "react";
import { Routes, Route } from "react-router-dom";

import { LibraryProvider } from "./context/LibraryContext";

import Header from "./components/Header";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import Books from "./pages/Books";
import BookDetail from "./pages/BookDetail";
import BorrowedBooks from "./pages/BorrowedBooks";
import ReadingHistory from "./pages/ReadingHistory";
import Recommendations from "./pages/Recommendations";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Manage from "./pages/Manage";
import RequireAuth from "./components/RequireAuth";

// App.jsx no longer holds any shared state itself, and no longer passes
// book/member/borrowing data down as props. LibraryProvider (Context API)
// makes that data available to every page directly, through useLibrary().
function App() {
  return (
    <LibraryProvider>
      <Header />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/books" element={<Books />} />
        <Route path="/books/:id" element={<BookDetail />} />
        <Route path="/borrowed" element={<BorrowedBooks />} />
        <Route path="/history" element={<ReadingHistory />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        {/* Experiment 3 + 4: token-protected CRUD screen (guests -> /login) */}
        <Route
          path="/manage"
          element={
            <RequireAuth>
              <Manage />
            </RequireAuth>
          }
        />
      </Routes>

      <Footer />
    </LibraryProvider>
  );
}

export default App;
