export type DepartmentSummary = {
  id: number;
  name: string;
};

export type ManagerSummary = {
  id: number;
  first_name: string;
  last_name: string;
  title?: string | null;
  avatar_url?: string | null;
};

export type UserPublic = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  title?: string | null;
  department_id?: number | null;
  department?: DepartmentSummary | null;
  manager_id?: number | null;
  manager?: ManagerSummary | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  phone?: string | null;
  role: "employee" | "admin";
  is_active: boolean;
};

export type UserUpdate = {
  first_name: string;
  last_name: string;
  title?: string | null;
  department_id?: number | null;
  manager_id?: number | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  phone?: string | null;
};

export type UserCreate = UserUpdate & {
  email: string;
  password?: string;
};

export type DepartmentPublic = {
  id: number;
  name: string;
  parent_id?: number | null;
  manager_id?: number | null;
  manager?: ManagerSummary | null;
  employee_count: number;
};

export type DepartmentPayload = {
  name: string;
  parent_id?: number | null;
  manager_id?: number | null;
};

export type OrgRootPublic = {
  name: string;
  manager_id?: number | null;
  manager?: ManagerSummary | null;
};

export type OrgRootPayload = {
  name: string;
  manager_id?: number | null;
};

export type NewsAuthor = {
  id: number;
  first_name: string;
  last_name: string;
  title?: string | null;
  avatar_url?: string | null;
};

export type NewsPublic = {
  id: number;
  title: string;
  summary: string;
  content: string;
  author_id: number;
  author: NewsAuthor;
  created_at: string;
  updated_at: string;
};
