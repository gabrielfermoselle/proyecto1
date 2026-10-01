export default function AuthLayout({ title, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-solo">
        <div className="auth-form">
          <h2>{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
