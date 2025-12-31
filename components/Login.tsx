import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';

interface LoginProps {
  onClose: () => void;
}

const Login: React.FC<LoginProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false); // New state for password reset
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isResetting) {
        await sendPasswordResetEmail(auth, email);
        setMessage(`Password reset email sent to ${email}. Check your inbox.`);
        setLoading(false);
      } else if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setMessage(`Verification email sent to ${email}. Please check your inbox.`);
        setLoading(false);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onClose(); // Close modal on success
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = "Authentication failed.";
      if (err.code === 'auth/invalid-email') msg = "Invalid email address.";
      if (err.code === 'auth/user-disabled') msg = "User account disabled.";
      if (err.code === 'auth/user-not-found') msg = "User not found.";
      if (err.code === 'auth/wrong-password') msg = "Invalid password.";
      if (err.code === 'auth/email-already-in-use') msg = "Email already in use.";
      if (err.code === 'auth/weak-password') msg = "Password is too weak.";
      if (err.code === 'auth/too-many-requests') msg = "Too many attempts. Try again later.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-xl shadow-2xl max-w-md w-full relative transform transition-all animate-fadeIn">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>

        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-6 text-center">
            {isResetting ? 'Reset Password' : (isRegistering ? 'Join the Race' : 'Welcome Back')}
        </h2>

        {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6 text-sm">
                {error}
            </div>
        )}

        {message && (
             <div className="bg-green-900/50 border border-green-500 text-green-200 px-4 py-3 rounded mb-6 text-sm">
                {message}
                <div className="mt-2 text-center">
                    <button onClick={() => {
                        if(isResetting) {
                            setIsResetting(false);
                            setMessage('');
                        } else {
                            onClose();
                        }
                    }} className="text-xs underline hover:text-white">
                        {isResetting ? 'Back to Login' : 'OK, start playing'}
                    </button>
                </div>
            </div>
        )}

        {!message && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all placeholder-slate-500"
              placeholder="runner@example.com"
              required
            />
          </div>
          
          {!isResetting && (
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border-slate-600 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none transition-all placeholder-slate-500"
                  placeholder="••••••••"
                  required
                />
              </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-6 rounded-lg font-bold text-black transform transition-all duration-200 
                ${loading 
                    ? 'bg-slate-600 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 hover:scale-105 shadow-lg shadow-orange-500/20'
                }`}
          >
            {loading ? 'Processing...' : (isResetting ? 'Send Reset Link' : (isRegistering ? 'Create Account' : 'Login'))}
          </button>
        </form>
        )}

        <div className="mt-6 flex flex-col gap-2 text-center">
          {!isResetting && !message && (
             <button
                type="button"
                onClick={() => {
                   setIsResetting(true);
                   setError('');
                   setMessage('');
                }}
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
             >
                Forgot Password?
             </button>
          )}

          <button
            type="button"
            onClick={() => {
                if (isResetting) {
                    setIsResetting(false);
                } else {
                    setIsRegistering(!isRegistering);
                }
                setError('');
                setMessage('');
            }}
            className="text-slate-400 hover:text-yellow-400 text-sm transition-colors underline decoration-dotted underline-offset-4"
          >
            {isResetting ? 'Back to Login' : (isRegistering ? 'Already have an account? Login' : 'New runner? Create account')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
