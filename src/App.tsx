import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: 12, borderBottom: "1px solid #333" }}>
        <Link to="/" style={{ marginRight: 12 }}>
          홈
        </Link>
        <Link to="/login" style={{ marginRight: 12 }}>로그인</Link>
        <Link to="/signup">회원가입</Link> 
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
    </BrowserRouter>
  );
}