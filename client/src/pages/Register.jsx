import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import AuthForm from '../components/AuthForm';

export default function Register() {
  const { i18n } = useTranslation();
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (user) return <Navigate to="/" replace />;

  return (
    <AuthForm
      mode="register"
      fields={['name', 'email', 'password']}
      onSubmit={async (values) => {
        await register({ ...values, preferredLanguage: i18n.language });
        const from = location.state?.from;
        navigate(from ? `${from.pathname}${from.search || ''}` : '/', { replace: true });
      }}
    />
  );
}
