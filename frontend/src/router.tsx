import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./ui/AppShell";
import { HomePage } from "./pages/HomePage";
import { UsersPage } from "./pages/UsersPage";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { LoginPage } from "./pages/LoginPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "users", element: <UsersPage /> },
      { path: "users/:id", element: <UserProfilePage /> },
      { path: "departments", element: <DepartmentsPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);


