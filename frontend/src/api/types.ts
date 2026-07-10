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

export type WorkStatus = "working" | "vacation" | "business_trip" | "sick_leave";

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
  work_status: WorkStatus;
  workday_start: string;
  workday_end: string;
  hire_date?: string | null;
  vacation_days_total: number;
  vacation_days_used: number;
  vacation_periods: VacationPeriod[];
  education_records: EducationRecord[];
  additional_education_records: AdditionalEducationRecord[];
  certificate_records: CertificateRecord[];
  course_records: CourseRecord[];
  skills: string[];
  achievement_records: AchievementRecord[];
  zup_last_vacation_info?: string | null;
  zup_source_updated_at?: string | null;
  role: "employee" | "admin";
  is_active: boolean;
  access_enabled: boolean;
};

export type VacationPeriod = {
  start_date: string;
  end_date: string;
  note?: string | null;
};

export type EducationRecord = {
  school: string;
  faculty: string;
  specialty: string;
  graduationYear: string;
};

export type AdditionalEducationRecord = {
  organization: string;
  course: string;
  date: string;
};

export type CertificateRecord = {
  title: string;
  organization: string;
  issuedAt: string;
  validUntil?: string | null;
};

export type CourseRecord = {
  title: string;
  provider: string;
  duration: string;
  status: string;
};

export type AchievementRecord = {
  icon: string;
  title: string;
  description: string;
  date: string;
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
  work_status?: WorkStatus;
  workday_start?: string;
  workday_end?: string;
  hire_date?: string | null;
  vacation_days_total?: number | null;
  vacation_days_used?: number | null;
  vacation_periods?: VacationPeriod[] | null;
  education_records?: EducationRecord[] | null;
  additional_education_records?: AdditionalEducationRecord[] | null;
  certificate_records?: CertificateRecord[] | null;
  course_records?: CourseRecord[] | null;
  skills?: string[] | null;
  achievement_records?: AchievementRecord[] | null;
};

export type UserCreate = UserUpdate & {
  email: string;
  password?: string;
};

export type UserZupSettingsPublic = {
  iin?: string | null;
};

export type DepartmentPublic = {
  id: number;
  name: string;
  parent_id?: number | null;
  manager_id?: number | null;
  manager?: ManagerSummary | null;
  employee_count: number;
  description?: string | null;
  documents: DepartmentDocument[];
  projects: DepartmentProject[];
};

export type DepartmentPayload = {
  name: string;
  parent_id?: number | null;
  manager_id?: number | null;
};

export type DepartmentDocument = {
  title: string;
  description: string;
  url: string;
};

export type DepartmentProject = {
  title: string;
  description: string;
  owner: string;
  status: string;
  dueDate: string;
};

export type DepartmentContentPayload = {
  description?: string | null;
  documents?: DepartmentDocument[] | null;
  projects?: DepartmentProject[] | null;
};

export type DepartmentUploadPublic = {
  url: string;
  name: string;
  content_type: string;
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

export type NewsComment = {
  id: number;
  news_id: number;
  author_id: number;
  author: NewsAuthor;
  content: string;
  created_at: string;
};

export type NewsReactionSummary = {
  reaction: "like" | "important" | "read";
  count: number;
  reacted_by_me: boolean;
};

export type NewsUploadPublic = {
  url: string;
  name: string;
  content_type: string;
  is_image: boolean;
};

export type NotificationPublic = {
  id: number;
  title: string;
  body: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
};

export type ChatMessagePublic = {
  id: number;
  sender_id: number;
  recipient_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
};

export type ChatConversationPublic = {
  user: ManagerSummary;
  last_message?: ChatMessagePublic | null;
  unread_count: number;
};

export type EmployeeGratitudePublic = {
  id: number;
  recipient_id: number;
  author_id: number;
  author: ManagerSummary;
  content: string;
  created_at: string;
  likes_count: number;
  liked_by_me: boolean;
};

export type EmployeeGratitudeListPublic = {
  total_count: number;
  total_likes: number;
  page: number;
  page_size: number;
  items: EmployeeGratitudePublic[];
};

export type UpcomingBirthdayPublic = {
  user: ManagerSummary;
  birth_date: string;
  next_date: string;
  days_until: number;
};

export type DailyOrderCount = {
  date: string;
  count: number;
  pickup_count: number;
  waybill_count: number;
};

export type CityDailyCount = {
  date: string;
  city_code: string;
  city_name: string;
  count: number;
};

export type OrdersSummary = {
  today: string;
  month_start: string;
  today_count: number;
  month_count: number;
  today_pickup_count: number;
  today_waybill_count: number;
  month_pickup_count: number;
  month_waybill_count: number;
  daily: DailyOrderCount[];
  delivery_by_city: CityDailyCount[];
  accepted_by_city: CityDailyCount[];
};
