import React from 'react';

const Login = ({ onLogin }) => {
  return (
    <div className="login-container">
      <h2>Login</h2>
      <button onClick={onLogin}>Login</button>
    </div>
  );
};

export default Login;
