import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import { AppShell } from "./ui/AppShell";
import { HomePage } from "./pages/HomePage";
import { UsersPage } from "./pages/UsersPage";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { LoginPage } from "./pages/LoginPage";
import { NewsEditorPage } from "./pages/NewsEditorPage";
import { NewsDetailsPage } from "./pages/NewsDetailsPage";
import { AdminPage } from "./pages/AdminPage";
import { OrgStructurePage } from "./pages/OrgStructurePage";
import { getToken } from "./api/client";

function ProtectedLayout() {
  const location = useLocation();

  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <AppShell />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "users", element: <UsersPage /> },
      { path: "users/:id", element: <UserProfilePage /> },
      { path: "departments", element: <DepartmentsPage /> },
      { path: "org", element: <OrgStructurePage /> },
      { path: "news/new", element: <NewsEditorPage /> },
      { path: "news/:id", element: <NewsDetailsPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
