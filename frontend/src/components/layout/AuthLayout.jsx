import { Outlet, useLocation } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="h-screen overflow-hidden">
      <Outlet />
    </div>
  )
}
