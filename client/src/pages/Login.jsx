import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthForm from '../components/AuthForm';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (user) return <Navigate to="/" replace />;

  return (
    <AuthForm
      mode="login"
      fields={['email', 'password']}
      onSubmit={async ({ email, password }) => {
        await login(email, password);
        // Return to the page that sent us here (e.g. a group join link).
        const from = location.state?.from;
        navigate(from ? `${from.pathname}${from.search || ''}` : '/', { replace: true });
      }}
    />
  );
}
