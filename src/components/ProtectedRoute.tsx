import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuth = sessionStorage.getItem('zf_authenticated') === 'true';
  
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;
