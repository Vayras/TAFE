import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function App() {
 
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = () => {
    fetch('http://localhost:8080/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmail: email }),
    })
      .then(res => {
        if (!res.ok) throw new Error('Access denied');
        return res.json();
      })
      .then(() => {
        navigate('/admin');
      })
      .catch(err => {
        setError(err.message || 'Login failed');
      });
  };

  return (
    
      <div className="flex items-center justify-center h-screen bg-gray-100 font-sans">
      <div className="flex flex-col justify-center bg-white p-8 rounded-lg shadow-lg w-96">
        <h1 className="text-5xl font-light text-center mb-4">TA ADMIN</h1>
        <input
          className="text-2xl font-light mb-2 p-2 border rounded"
          type="text"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="enter your email.."
        />
        <button
          className="w-full h-12 text-3xl mb-2 bg-indigo-600 text-white rounded"
          onClick={handleLogin}
        >
          Log In
        </button>
        {error && <div className="text-red-500 mt-2">{error}</div>}
      </div>
    </div>
  )
}

export default App;
