export type UserPublic = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  title?: string | null;
  department_id?: number | null;
  avatar_url?: string | null;
  bio?: string | null;
  location?: string | null;
  phone?: string | null;
};

export type DepartmentPublic = {
  id: number;
  name: string;
  parent_id?: number | null;
};

